import type { PgBoss } from "pg-boss";

/**
 * pg-boss queues for the report pipeline. Policies are enforced by pg-boss
 * with unique indexes on (queue, singletonKey):
 * - exclusive: at most one job per key across created/retry/active
 * - stately: at most one job per key in each of created/retry/active
 * Every pipeline job uses the report id as its singleton key, so duplicate
 * webhooks or retries cannot start parallel work for the same report.
 */
export const QUEUES = {
  start: "report.start",
  collect: "report.collect",
  analyze: "report.analyze",
  timeout: "report.timeout",
  failed: "report.failed",
  reconcile: "report.reconcile",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export type ReportJobData = { reportId: string };
export type TimeoutJobData = { reportId: string; attempt: number };

type QueueDefinition = {
  name: QueueName;
  policy: "standard" | "exclusive" | "stately" | "singleton";
  retryLimit: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  retryDelayMax?: number;
  expireInSeconds: number;
  /** null clears a dead letter on queues created by an earlier version. */
  deadLetter?: QueueName | null;
};

export const QUEUE_DEFINITIONS: QueueDefinition[] = [
  {
    // Generate prompts (visibility) and trigger Bright Data collections.
    name: QUEUES.start,
    policy: "exclusive",
    retryLimit: 4,
    retryDelay: 10,
    retryBackoff: true,
    retryDelayMax: 300,
    // Prompt generation (2 min timeout) plus two triggers (30 s each), with room to spare.
    expireInSeconds: 600,
    deadLetter: QUEUES.failed,
  },
  {
    // Webhook-driven: check snapshot progress and hand off to analysis. Only a
    // hint: if it keeps failing, the timeout chain still finishes the report,
    // so it must not dead-letter (that would fail a healthy report).
    name: QUEUES.collect,
    policy: "stately",
    retryLimit: 5,
    retryDelay: 15,
    retryBackoff: true,
    retryDelayMax: 300,
    expireInSeconds: 120,
    deadLetter: null,
  },
  {
    // Download snapshots, validate rows, call Claude, compute metrics, complete.
    name: QUEUES.analyze,
    policy: "exclusive",
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    retryDelayMax: 600,
    // Covers several LLM calls (each capped at 4 min x 2 attempts by the client).
    expireInSeconds: 900,
    deadLetter: QUEUES.failed,
  },
  {
    // Fallback when a webhook never arrives: poll Bright Data, then fail.
    name: QUEUES.timeout,
    policy: "standard",
    retryLimit: 3,
    retryDelay: 30,
    expireInSeconds: 120,
  },
  {
    // Dead letters from the queues above: fail the report and release quota.
    name: QUEUES.failed,
    policy: "standard",
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 120,
  },
  {
    // Scheduled sweep for anything stuck.
    name: QUEUES.reconcile,
    policy: "singleton",
    retryLimit: 0,
    expireInSeconds: 300,
  },
];

/** Idempotently creates or updates every pipeline queue. */
export async function ensureQueues(boss: PgBoss): Promise<void> {
  // Dead-letter targets must exist before the queues that reference them.
  const ordered = [...QUEUE_DEFINITIONS].sort((a, b) => Number(Boolean(a.deadLetter)) - Number(Boolean(b.deadLetter)));
  for (const { name, policy, deadLetter, ...options } of ordered) {
    const existing = await boss.getQueue(name);
    if (existing) {
      await boss.updateQueue(name, { ...options, deadLetter: deadLetter ?? null });
    } else {
      await boss.createQueue(name, { policy, ...options, ...(deadLetter ? { deadLetter } : {}) });
    }
  }
}

export const RECONCILE_CRON = "*/5 * * * *";
