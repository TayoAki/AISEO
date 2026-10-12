/**
 * Report pipeline jobs. Each handler is idempotent and checks the report's
 * state first, so retries, duplicate webhooks, timeouts and the reconciler
 * can all run safely in any order.
 *
 *   start   -> generate prompts (visibility), trigger Bright Data, arm timeout
 *   collect -> (webhook) check snapshot progress, hand off to analyze
 *   analyze -> download, validate, Claude, metrics, complete + commit quota
 *   timeout -> poll when no webhook arrived; give up after the max wait
 *   failed  -> dead letters: fail the report and refund the credit
 *   reconcile (cron) -> repair anything stuck
 */
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";

import { reportInputSchema } from "@/lib/report-input";

import type { Database } from "../db/client";
import { report, reportCollection } from "../db/schema";
import type { Env } from "../env";
import { settleReservation } from "../quota/quota";
import { keywordResultSchema, visibilityResultSchema } from "../reports/results";
import { advanceReport, completeReport, failReport, isTerminal, notifyReport } from "../reports/state";
import { describeError, NonRetryableError, type FailureCode } from "./errors";
import { analyzeKeyword } from "./keyword";
import { collectionRequest, platformsFor, type Providers } from "./providers";
import { QUEUES, type ReportJobData, type TimeoutJobData } from "./queues";
import { parseCollection, type ParsedCollection } from "./records";
import { analyzeVisibility, generateVisibilityPrompts, type VisibilityCollections } from "./visibility";
import { collectionWebhookUrl } from "./webhook-token";

export type PipelineDeps = { db: Database; boss: PgBoss; providers: Providers; env: Env };

const DONE_STATUSES = ["ready", "failed", "canceled"] as const;

async function loadReport(db: Database, reportId: string) {
  const [row] = await db
    .select({
      id: report.id,
      type: report.type,
      status: report.status,
      input: report.input,
      tier: report.tier,
      prompts: report.prompts,
      failureDetail: report.failureDetail,
      createdAt: report.createdAt,
      startedAt: report.startedAt,
    })
    .from(report)
    .where(eq(report.id, reportId))
    .limit(1);
  return row ?? null;
}

/** Runs a handler; non-retryable errors fail the report, others retry. */
export async function runReportJob(
  deps: PipelineDeps,
  job: string,
  reportId: string,
  handler: () => Promise<void>,
): Promise<void> {
  try {
    await handler();
  } catch (error) {
    if (error instanceof NonRetryableError) {
      console.warn(`[pipeline] ${job} failed permanently`, { reportId, code: error.code, detail: error.detail });
      await failReport(deps.db, reportId, error.code, error.detail);
      // e.g. Gemini rejected after ChatGPT was already triggered: stop paying for it.
      await cancelOutstandingCollections(deps, reportId);
      return;
    }
    const detail = describeError(error);
    console.error(`[pipeline] ${job} failed, will retry`, { reportId, detail });
    await deps.db.update(report).set({ failureDetail: `${job}: ${detail}` }).where(eq(report.id, reportId));
    throw error;
  }
}

/** Cheap re-check before spending money: a report may end while a job is still running. */
async function isStillActive(db: Database, reportId: string): Promise<boolean> {
  const [row] = await db.select({ status: report.status }).from(report).where(eq(report.id, reportId)).limit(1);
  return Boolean(row && !isTerminal(row.status));
}

async function cancelSnapshot(deps: PipelineDeps, reportId: string, snapshotId: string): Promise<void> {
  await deps.providers.collections.cancel(snapshotId).catch((error: unknown) => {
    console.warn("[pipeline] snapshot cancel failed", { reportId, snapshotId, error: describeError(error) });
  });
}

/** Cancels every still-running collection of a report (after it failed or ran out of time). */
export async function cancelOutstandingCollections(deps: PipelineDeps, reportId: string): Promise<void> {
  const outstanding = await deps.db
    .select()
    .from(reportCollection)
    .where(and(eq(reportCollection.reportId, reportId), inArray(reportCollection.status, ["pending", "triggered"])));
  for (const collection of outstanding) {
    if (collection.snapshotId) await cancelSnapshot(deps, reportId, collection.snapshotId);
    await deps.db
      .update(reportCollection)
      .set({ status: "canceled" })
      .where(and(eq(reportCollection.id, collection.id), inArray(reportCollection.status, ["pending", "triggered"])));
  }
}

export async function handleStart(deps: PipelineDeps, { reportId }: ReportJobData): Promise<void> {
  const { db, providers, env, boss } = deps;
  const row = await loadReport(db, reportId);
  if (!row || isTerminal(row.status)) return;
  const input = reportInputSchema.parse(row.input);

  await advanceReport(db, reportId, {
    status: "collecting",
    progress: 10,
    step: input.type === "keyword" ? "Asking Perplexity about your keyword" : "Writing neutral customer prompts",
    markStarted: true,
  });

  // Prompts are persisted before any scrape so retries reuse them.
  let prompts = row.prompts;
  if (input.type === "visibility" && !prompts) {
    const generated = await generateVisibilityPrompts(providers.llm, input);
    await db.update(report).set({ prompts: generated }).where(and(eq(report.id, reportId), isNull(report.prompts)));
    prompts = (await loadReport(db, reportId))?.prompts ?? generated;
    await notifyReport(db, reportId);
  }
  // The model call can be slow: if the report ended meanwhile, don't trigger anything.
  if (!(await isStillActive(db, reportId))) return;

  const platforms = platformsFor(input.type);
  await db
    .insert(reportCollection)
    .values(platforms.map((platform) => ({ reportId, platform })))
    .onConflictDoNothing();
  const collections = await db.select().from(reportCollection).where(eq(reportCollection.reportId, reportId));

  for (const collection of collections.filter((c) => c.status === "pending")) {
    if (!(await isStillActive(db, reportId))) return;
    const { datasetId, inputs } = collectionRequest(env, input, collection.platform, prompts);
    const snapshotId = await providers.collections.trigger({
      datasetId,
      inputs,
      notifyUrl: collectionWebhookUrl(env.APP_URL, collection.id, env.WEBHOOK_SIGNING_SECRET),
      fakeContext:
        input.type === "visibility"
          ? { brand: input.brand, website: input.website }
          : { keyword: input.keyword },
    });
    const claimed = await db
      .update(reportCollection)
      .set({ status: "triggered", snapshotId, triggeredAt: new Date() })
      .where(and(eq(reportCollection.id, collection.id), eq(reportCollection.status, "pending")))
      .returning({ id: reportCollection.id });
    if (claimed.length === 0) {
      // A parallel attempt triggered this collection first: this snapshot is a duplicate.
      await cancelSnapshot(deps, reportId, snapshotId);
    } else if (!(await isStillActive(db, reportId))) {
      // The report ended while we were triggering it.
      await cancelOutstandingCollections(deps, reportId);
      return;
    }
  }

  await advanceReport(db, reportId, {
    status: "collecting",
    progress: 25,
    step: input.type === "keyword" ? "Waiting for Perplexity's answers" : "Waiting for ChatGPT and Gemini answers",
  });

  await boss.send(
    QUEUES.timeout,
    { reportId, attempt: 1 } satisfies TimeoutJobData,
    { startAfter: env.COLLECTION_TIMEOUT_MINUTES * 60, singletonKey: `${reportId}:1` },
  );
}

/** Checks Bright Data for every triggered collection and records terminal states. */
async function refreshCollections(deps: PipelineDeps, reportId: string) {
  const { db, providers } = deps;
  const triggered = await db
    .select()
    .from(reportCollection)
    .where(and(eq(reportCollection.reportId, reportId), eq(reportCollection.status, "triggered")));

  for (const collection of triggered) {
    if (!collection.snapshotId) continue;
    const status = await providers.collections.progress(collection.snapshotId);
    if (status === "ready") {
      await db
        .update(reportCollection)
        .set({ status: "ready", readyAt: new Date() })
        .where(and(eq(reportCollection.id, collection.id), eq(reportCollection.status, "triggered")));
    } else if (status === "failed" || status === "canceled") {
      await db
        .update(reportCollection)
        .set({ status: status === "failed" ? "failed" : "canceled" })
        .where(and(eq(reportCollection.id, collection.id), eq(reportCollection.status, "triggered")));
    }
  }

  return collectionState(db, reportId);
}

/** Collection statuses as recorded, without asking Bright Data. */
async function collectionState(db: Database, reportId: string) {
  const all = await db.select().from(reportCollection).where(eq(reportCollection.reportId, reportId));
  return {
    all,
    done: all.length > 0 && all.every((c) => (DONE_STATUSES as readonly string[]).includes(c.status)),
    ready: all.filter((c) => c.status === "ready").length,
  };
}

async function proceedWhenCollected(deps: PipelineDeps, reportId: string, state: Awaited<ReturnType<typeof collectionState>>) {
  if (state.ready === 0) {
    await failReport(
      deps.db,
      reportId,
      "COLLECTION_FAILED",
      `All collections ended without data: ${state.all.map((c) => `${c.platform}=${c.status}`).join(", ")}`,
    );
    return;
  }
  await deps.boss.send(QUEUES.analyze, { reportId } satisfies ReportJobData, { singletonKey: reportId });
}

export async function handleCollect(deps: PipelineDeps, { reportId }: ReportJobData): Promise<void> {
  const row = await loadReport(deps.db, reportId);
  if (!row || isTerminal(row.status) || row.status === "analyzing") return;

  const state = await refreshCollections(deps, reportId);
  if (state.done) {
    await proceedWhenCollected(deps, reportId, state);
    return;
  }
  if (state.ready > 0) {
    const ready = state.all.filter((c) => c.status === "ready").map((c) => c.platform);
    await advanceReport(deps.db, reportId, {
      status: "collecting",
      progress: 40,
      step: `Got ${ready.join(" and ")} answers, waiting for the rest`,
    });
  }
}

export async function handleAnalyze(deps: PipelineDeps, { reportId }: ReportJobData): Promise<void> {
  const { db, providers } = deps;
  const row = await loadReport(db, reportId);
  if (!row || isTerminal(row.status)) return;
  const input = reportInputSchema.parse(row.input);
  const paid = row.tier !== "free";

  await advanceReport(db, reportId, { status: "analyzing", progress: 60, step: "Reading the collected answers" });

  const ready = await db
    .select()
    .from(reportCollection)
    .where(and(eq(reportCollection.reportId, reportId), eq(reportCollection.status, "ready")));

  const parsed: Partial<Record<string, ParsedCollection>> = {};
  for (const collection of ready) {
    if (!collection.snapshotId) continue;
    const records = await providers.collections.download(collection.snapshotId);
    const result = parseCollection(records);
    parsed[collection.platform] = result;
    await db
      .update(reportCollection)
      .set({ recordCount: result.total, errorCount: result.errorRows })
      .where(eq(reportCollection.id, collection.id));
  }

  await advanceReport(db, reportId, { status: "analyzing", progress: 75, step: "Analyzing the evidence" });

  let result: unknown;
  if (input.type === "keyword") {
    const perplexity = parsed.perplexity ?? { total: 0, answers: [], errorRows: 0, errorSamples: [] };
    result = keywordResultSchema.parse(await analyzeKeyword({ input, parsed: perplexity, llm: providers.llm, paid }));
  } else {
    if (!row.prompts?.length) throw new NonRetryableError("INTERNAL", "Visibility report reached analysis without prompts");
    const collections: VisibilityCollections = { chatgpt: parsed.chatgpt, gemini: parsed.gemini };
    result = visibilityResultSchema.parse(
      await analyzeVisibility({ input, prompts: row.prompts, collections, llm: providers.llm, paid }),
    );
  }

  await advanceReport(db, reportId, { status: "analyzing", progress: 90, step: "Building your report" });
  await completeReport(db, reportId, result);
}

export async function handleTimeout(deps: PipelineDeps, { reportId, attempt }: TimeoutJobData): Promise<void> {
  const { db, env, boss } = deps;
  const row = await loadReport(db, reportId);
  if (!row || isTerminal(row.status) || row.status === "analyzing") return;

  const startedAt = (row.startedAt ?? row.createdAt).getTime();
  const waitedMinutes = (Date.now() - startedAt) / 60_000;

  if (waitedMinutes < env.COLLECTION_MAX_WAIT_MINUTES) {
    // Arm the next check before polling, so a failing poll can't end the chain.
    await boss.send(
      QUEUES.timeout,
      { reportId, attempt: attempt + 1 } satisfies TimeoutJobData,
      { startAfter: 5 * 60, singletonKey: `${reportId}:${attempt + 1}` },
    );
    const state = await refreshCollections(deps, reportId);
    if (state.done) await proceedWhenCollected(deps, reportId, state);
    return;
  }

  // Out of time: poll once more, but give up even if Bright Data can't answer.
  let state: Awaited<ReturnType<typeof collectionState>>;
  try {
    state = await refreshCollections(deps, reportId);
  } catch (error) {
    console.warn("[pipeline] final collection poll failed, giving up", { reportId, error: describeError(error) });
    state = await collectionState(db, reportId);
  }
  if (state.done) {
    await proceedWhenCollected(deps, reportId, state);
    return;
  }

  // Give up on stragglers: cancel them (they deliver nothing once canceled).
  await cancelOutstandingCollections(deps, reportId);
  const ready = (await collectionState(db, reportId)).ready;
  if (ready > 0) {
    // Partial data (e.g. ChatGPT answered, Gemini stuck): analyze what we have.
    await boss.send(QUEUES.analyze, { reportId } satisfies ReportJobData, { singletonKey: reportId });
  } else {
    await failReport(db, reportId, "TIMED_OUT", `No collection finished within ${env.COLLECTION_MAX_WAIT_MINUTES} minutes`);
  }
}

function deadLetterCode(row: NonNullable<Awaited<ReturnType<typeof loadReport>>>): FailureCode {
  if (row.status === "queued") return "INTERNAL";
  if (row.type === "visibility" && !row.prompts) return "PROMPTS_FAILED";
  if (row.status === "analyzing") return "ANALYSIS_FAILED";
  return "COLLECTION_FAILED";
}

export async function handleDeadLetter(deps: PipelineDeps, { reportId }: ReportJobData): Promise<void> {
  const row = await loadReport(deps.db, reportId);
  if (!row) return;
  const code = deadLetterCode(row);
  if (await failReport(deps.db, reportId, code, row.failureDetail ?? "Retries exhausted or job expired")) {
    console.warn("[pipeline] report failed after exhausting retries", { reportId, code });
  }
  await cancelOutstandingCollections(deps, reportId);
}

/** Periodic repair for anything the event-driven path missed. */
export async function handleReconcile(deps: PipelineDeps): Promise<void> {
  const { db, boss, env } = deps;
  const minutesAgo = (m: number) => sql`now() - make_interval(mins => ${m})`;
  const counts = { expired: 0, requeued: 0, collecting: 0, analyzingFailed: 0, settled: 0, errors: 0 };

  // One bad row must not stop the rest of the sweep.
  const each = async <T extends { id: string }>(rows: T[], repair: (row: T) => Promise<void>) => {
    for (const row of rows) {
      try {
        await repair(row);
      } catch (error) {
        counts.errors += 1;
        console.error("[pipeline] reconcile failed for report", { reportId: row.id, error: describeError(error) });
      }
    }
  };

  // Hard cap by age: retries that keep failing also keep updated_at fresh, so
  // the idle checks below could miss them forever.
  const expired = await db
    .select({ id: report.id, status: report.status })
    .from(report)
    .where(
      and(
        inArray(report.status, ["queued", "collecting", "analyzing"]),
        lt(report.createdAt, minutesAgo(env.COLLECTION_MAX_WAIT_MINUTES + 120)),
      ),
    );
  await each(expired, async (row) => {
    const code: FailureCode = row.status === "analyzing" ? "ANALYSIS_FAILED" : "TIMED_OUT";
    if (await failReport(db, row.id, code, "Exceeded the maximum run time (reconciler)")) counts.expired += 1;
    await cancelOutstandingCollections(deps, row.id);
  });

  const queued = await db
    .select({ id: report.id, updatedAt: report.updatedAt })
    .from(report)
    .where(and(eq(report.status, "queued"), lt(report.updatedAt, minutesAgo(10))));
  await each(queued, async (row) => {
    if (Date.now() - row.updatedAt.getTime() > 60 * 60_000) {
      await failReport(db, row.id, "INTERNAL", "Report never started (reconciler)");
    } else {
      await boss.send(QUEUES.start, { reportId: row.id } satisfies ReportJobData, { singletonKey: row.id });
      counts.requeued += 1;
    }
  });

  const collecting = await db
    .select({ id: report.id })
    .from(report)
    .where(and(eq(report.status, "collecting"), lt(report.updatedAt, minutesAgo(env.COLLECTION_MAX_WAIT_MINUTES + 15))));
  await each(collecting, async (row) => {
    await boss.send(QUEUES.timeout, { reportId: row.id, attempt: 99 } satisfies TimeoutJobData, {
      singletonKey: `${row.id}:reconcile`,
    });
    counts.collecting += 1;
  });

  const analyzing = await db
    .select({ id: report.id })
    .from(report)
    .where(and(eq(report.status, "analyzing"), lt(report.updatedAt, minutesAgo(45))));
  await each(analyzing, async (row) => {
    if (await failReport(db, row.id, "ANALYSIS_FAILED", "Analysis stalled (reconciler)")) counts.analyzingFailed += 1;
  });

  // Finished reports must never hold a reservation.
  const unsettled = await db
    .select({ id: report.id, status: report.status })
    .from(report)
    .where(and(eq(report.quotaState, "reserved"), inArray(report.status, ["completed", "failed", "canceled"])));
  await each(unsettled, async (row) => {
    await db.transaction((tx) => settleReservation(tx, row.id, row.status === "completed" ? "commit" : "release"));
    counts.settled += 1;
  });

  if (Object.values(counts).some((n) => n > 0)) console.info("[pipeline] reconcile", counts);
}
