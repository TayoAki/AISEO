import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { freeEntitlements, type Entitlements } from "@/server/billing/entitlements";
import { report, reportCollection, reportUsage, usageBucket } from "@/server/db/schema";
import { getEnv } from "@/server/env";
import { createBoss } from "@/server/pipeline/boss";
import { reportCostUsd } from "@/server/pipeline/costs";
import { NonRetryableError } from "@/server/pipeline/errors";
import { FakeCollectionProvider, FakeLlm } from "@/server/pipeline/fake-providers";
import {
  handleAnalyze,
  handleCollect,
  handleReconcile,
  handleStart,
  handleTimeout,
  runReportJob,
  type PipelineDeps,
} from "@/server/pipeline/jobs";
import { QUEUES } from "@/server/pipeline/queues";
import { handleCollectionCallback } from "@/server/pipeline/webhook-handler";
import { collectionWebhookUrl } from "@/server/pipeline/webhook-token";
import { createReport } from "@/server/reports/create";
import { completeReport, failReport } from "@/server/reports/state";

import { createTestUser, openTestDatabase, resetTestDatabase, TEST_DATABASE_URL } from "../helpers/db";

const handles = openTestDatabase(10);
const db = handles.db;
let boss: PgBoss;
let deps: PipelineDeps;

const pro: Entitlements = { plan: "pro", isPaid: true, insights: true, subscription: null };

beforeAll(async () => {
  await resetTestDatabase();
  boss = createBoss("migrate", TEST_DATABASE_URL);
  await boss.start();
  deps = {
    db,
    boss,
    providers: {
      collections: new FakeCollectionProvider({ notify: false, delayMs: 0 }),
      llm: new FakeLlm(),
      costPerRecordUsd: 0.0015,
    },
    env: getEnv(),
  };
});

afterAll(async () => {
  await boss.stop({ graceful: false, close: true });
  await handles.pool.end();
});

async function jobsFor(reportId: string) {
  const result = await db.execute<{ name: string; state: string }>(
    sql`select name, state from pgboss.job where data->>'reportId' = ${reportId} order by created_on`,
  );
  return result.rows;
}

async function reportRow(id: string) {
  const [row] = await db.select().from(report).where(eq(report.id, id));
  return row!;
}

async function bucketFor(reportId: string) {
  const row = await reportRow(reportId);
  const [bucket] = await db.select().from(usageBucket).where(eq(usageBucket.id, row.usageBucketId));
  return bucket!;
}

async function newReport(userId: string, input: Parameters<typeof createReport>[1]["input"], entitlements = freeEntitlements()) {
  const result = await createReport(
    { db, boss },
    { userId, input, idempotencyKey: randomUUID(), entitlements, now: new Date(), maxActiveReports: 3 },
  );
  if (result.status !== "created") throw new Error(`expected created, got ${result.status}`);
  return result.reportId;
}

describe("createReport", () => {
  it("reserves quota, creates the report and enqueues its start job in one transaction", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "crm software", country: "US" });
    const row = await reportRow(reportId);
    expect(row).toMatchObject({ status: "queued", quotaState: "reserved", tier: "free", title: "crm software" });
    expect(await bucketFor(reportId)).toMatchObject({ reserved: 1, used: 0, quota: 2 });
    expect((await jobsFor(reportId)).map((j) => j.name)).toEqual([QUEUES.start]);
  });

  it("returns the existing report for a repeated idempotency key without reserving twice", async () => {
    const user = await createTestUser(db);
    const args = {
      userId: user.id,
      input: { type: "keyword" as const, keyword: "running shoes", country: "GB" as const },
      idempotencyKey: "same-key",
      entitlements: freeEntitlements(),
      now: new Date(),
      maxActiveReports: 3,
    };
    const first = await createReport({ db, boss }, args);
    const second = await createReport({ db, boss }, args);
    expect(second).toEqual({ status: "duplicate", reportId: first.status === "created" ? first.reportId : "" });
    expect((await bucketFor(second.status === "duplicate" ? second.reportId : "")).reserved).toBe(1);
  });

  it("enforces the plan allowance and the active-report cap", async () => {
    const user = await createTestUser(db);
    const input = { type: "visibility" as const, website: "https://acme.example", brand: "Acme", topic: "crm tools" };
    const common = { userId: user.id, input, entitlements: freeEntitlements(), now: new Date() };
    const capped = await Promise.all(
      Array.from({ length: 4 }, () => createReport({ db, boss }, { ...common, idempotencyKey: randomUUID(), maxActiveReports: 10 })),
    );
    expect(capped.filter((r) => r.status === "created")).toHaveLength(2);
    expect(capped.filter((r) => r.status === "limit_reached")).toHaveLength(2);

    const other = await createTestUser(db);
    await createReport({ db, boss }, { ...common, userId: other.id, idempotencyKey: randomUUID(), maxActiveReports: 1 });
    const blocked = await createReport({ db, boss }, { ...common, userId: other.id, idempotencyKey: randomUUID(), maxActiveReports: 1 });
    expect(blocked).toEqual({ status: "too_many_active", limit: 1 });
  });

  it("pauses new reports after repeated input-caused failures (which are refunded)", async () => {
    const user = await createTestUser(db);
    const input = { type: "keyword" as const, keyword: "simulate failure", country: "US" as const };
    const args = { userId: user.id, input, entitlements: pro, now: new Date(), maxActiveReports: 10, maxFailedReportsPerDay: 2 };
    for (let i = 0; i < 2; i++) {
      const created = await createReport({ db, boss }, { ...args, idempotencyKey: randomUUID() });
      if (created.status !== "created") throw new Error(created.status);
      await failReport(db, created.reportId, "NO_USABLE_ANSWERS", "test");
    }
    const paused = await createReport({ db, boss }, { ...args, idempotencyKey: randomUUID() });
    expect(paused).toEqual({ status: "too_many_failures", limit: 2 });
  });
});

describe("keyword pipeline", () => {
  it("runs start -> webhook -> collect -> analyze and commits the credit", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "project management software", country: "US" });

    await runReportJob(deps, "start", reportId, () => handleStart(deps, { reportId }));
    let row = await reportRow(reportId);
    expect(row.status).toBe("collecting");
    const [collection] = await db.select().from(reportCollection).where(eq(reportCollection.reportId, reportId));
    expect(collection).toMatchObject({ platform: "perplexity", status: "triggered" });
    expect((await jobsFor(reportId)).map((j) => j.name)).toContain(QUEUES.timeout);

    // Webhook with a forged token is rejected; the real one queues a collect job.
    const token = new URL(collectionWebhookUrl(deps.env.APP_URL, collection!.id, deps.env.WEBHOOK_SIGNING_SECRET)).searchParams.get("token");
    const signingSecret = deps.env.WEBHOOK_SIGNING_SECRET;
    expect(await handleCollectionCallback({ db, boss, signingSecret }, { collectionId: collection!.id, token: "forged" })).toBe("unauthorized");
    expect(await handleCollectionCallback({ db, boss, signingSecret }, { collectionId: collection!.id, token })).toBe("accepted");
    expect(await handleCollectionCallback({ db, boss, signingSecret }, { collectionId: collection!.id, token })).toBe("accepted");
    expect((await jobsFor(reportId)).filter((j) => j.name === QUEUES.collect)).toHaveLength(1);

    await runReportJob(deps, "collect", reportId, () => handleCollect(deps, { reportId }));
    expect((await jobsFor(reportId)).map((j) => j.name)).toContain(QUEUES.analyze);

    await runReportJob(deps, "analyze", reportId, () => handleAnalyze(deps, { reportId }));
    row = await reportRow(reportId);
    expect(row).toMatchObject({ status: "completed", progress: 100, quotaState: "committed", resultVersion: 1 });
    expect(row.result).not.toHaveProperty("insights");
    expect(await bucketFor(reportId)).toMatchObject({ used: 1, reserved: 0 });

    // What the report cost: one Bright Data download (3 records) and one model call.
    const usage = await db.select().from(reportUsage).where(eq(reportUsage.reportId, reportId));
    expect(usage.find((u) => u.provider === "brightdata")).toMatchObject({
      task: "collect:perplexity",
      records: 3,
      costMicros: 4500,
    });
    expect(usage.find((u) => u.provider === "anthropic")).toMatchObject({ task: "keyword-analysis", model: "fake" });
    expect(await reportCostUsd(db, reportId)).toBeCloseTo(0.0045);
  });
});

describe("visibility pipeline", () => {
  it("persists prompts before scraping and generates paid sections for paid plans", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(
      user.id,
      { type: "visibility", website: "https://acme.example", brand: "Acme", topic: "help desk software" },
      pro,
    );

    await runReportJob(deps, "start", reportId, () => handleStart(deps, { reportId }));
    const afterStart = await reportRow(reportId);
    expect(afterStart.prompts).toHaveLength(5);
    const collections = await db.select().from(reportCollection).where(eq(reportCollection.reportId, reportId));
    expect(collections.map((c) => c.platform).sort()).toEqual(["chatgpt", "gemini"]);

    // A retried start must not regenerate prompts or re-trigger collections.
    await runReportJob(deps, "start", reportId, () => handleStart(deps, { reportId }));
    expect((await reportRow(reportId)).prompts).toEqual(afterStart.prompts);
    const again = await db.select().from(reportCollection).where(eq(reportCollection.reportId, reportId));
    expect(again.map((c) => c.snapshotId).sort()).toEqual(collections.map((c) => c.snapshotId).sort());

    await runReportJob(deps, "collect", reportId, () => handleCollect(deps, { reportId }));
    await runReportJob(deps, "analyze", reportId, () => handleAnalyze(deps, { reportId }));

    const row = await reportRow(reportId);
    expect(row.status).toBe("completed");
    const result = row.result as { platforms: Array<{ answered: number; failed: number }>; recommendations?: unknown[] };
    // The fake provider returns one error row per platform: excluded, not scored.
    expect(result.platforms.every((p) => p.answered === 4 && p.failed === 1)).toBe(true);
    expect(result.recommendations?.length).toBeGreaterThan(0);
  });
});

describe("failure paths", () => {
  it("refunds the credit when every collection fails", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "blocked keyword", country: "US" });
    await runReportJob(deps, "start", reportId, () => handleStart(deps, { reportId }));
    await db.update(reportCollection).set({ status: "failed" }).where(eq(reportCollection.reportId, reportId));

    await runReportJob(deps, "collect", reportId, () => handleCollect(deps, { reportId }));
    const row = await reportRow(reportId);
    expect(row).toMatchObject({ status: "failed", errorCode: "COLLECTION_FAILED", quotaState: "released" });
    expect(row.errorMessage).toContain("refunded");
    expect(await bucketFor(reportId)).toMatchObject({ used: 0, reserved: 0 });
  });

  it("fails immediately with a safe message on non-retryable errors", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "declined", country: "US" });
    await runReportJob(deps, "analyze", reportId, async () => {
      throw new NonRetryableError("ANALYSIS_DECLINED", "category=general_harms");
    });
    const row = await reportRow(reportId);
    expect(row).toMatchObject({ status: "failed", errorCode: "ANALYSIS_DECLINED", quotaState: "released" });
    expect(row.errorMessage).not.toContain("general_harms");
    expect(row.failureDetail).toContain("general_harms");
  });

  it("records retryable errors and rethrows so pg-boss retries", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "flaky", country: "US" });
    await expect(
      runReportJob(deps, "start", reportId, async () => {
        throw new Error("Bright Data 503");
      }),
    ).rejects.toThrow("503");
    expect(await reportRow(reportId)).toMatchObject({ status: "queued", quotaState: "reserved" });
    expect((await reportRow(reportId)).failureDetail).toContain("503");
  });
});

describe("guarded transitions and reconciliation", () => {
  it("never overwrites a finished report", async () => {
    const user = await createTestUser(db);
    const failed = await newReport(user.id, { type: "keyword", keyword: "late success", country: "US" });
    expect(await failReport(db, failed, "TIMED_OUT", "test")).toBe(true);
    expect(await completeReport(db, failed, {})).toBe(false);
    expect(await reportRow(failed)).toMatchObject({ status: "failed", quotaState: "released" });

    const user2 = await createTestUser(db);
    const done = await newReport(user2.id, { type: "keyword", keyword: "late failure", country: "US" });
    expect(await completeReport(db, done, { version: 1 })).toBe(true);
    expect(await failReport(db, done, "INTERNAL", "late")).toBe(false);
    expect(await reportRow(done)).toMatchObject({ status: "completed", quotaState: "committed" });
  });

  it("settles reservations left on finished reports", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "orphan", country: "US" });
    await db.update(report).set({ status: "failed" }).where(and(eq(report.id, reportId)));
    await handleReconcile(deps);
    expect(await reportRow(reportId)).toMatchObject({ quotaState: "released" });
    expect(await bucketFor(reportId)).toMatchObject({ reserved: 0, used: 0 });
  });
});

/** A collection provider that records calls and lets a test inject behavior. */
class ScriptedProvider extends FakeCollectionProvider {
  canceled: string[] = [];
  triggered: string[] = [];
  onTrigger: ((snapshotId: string) => Promise<void>) | null = null;
  progressError: Error | null = null;

  constructor() {
    super({ notify: false, delayMs: 60 * 60_000 });
  }

  override async trigger(args: Parameters<FakeCollectionProvider["trigger"]>[0]): Promise<string> {
    const snapshotId = await super.trigger(args);
    this.triggered.push(snapshotId);
    await this.onTrigger?.(snapshotId);
    return snapshotId;
  }

  override async progress(snapshotId: string) {
    if (this.progressError) throw this.progressError;
    return super.progress(snapshotId);
  }

  override async cancel(snapshotId: string): Promise<void> {
    this.canceled.push(snapshotId);
    await super.cancel(snapshotId);
  }
}

describe("pipeline robustness", () => {
  function scriptedDeps(provider: ScriptedProvider, llm = new FakeLlm()): PipelineDeps {
    return { ...deps, providers: { collections: provider, llm, costPerRecordUsd: 0.0015 } };
  }

  it("never moves a report's status backwards", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "forward only", country: "US" });
    await db.update(report).set({ status: "analyzing" }).where(eq(report.id, reportId));
    const { advanceReport } = await import("@/server/reports/state");
    expect(await advanceReport(db, reportId, { status: "collecting", progress: 25, step: "late" })).toBe(false);
    expect((await reportRow(reportId)).status).toBe("analyzing");
  });

  it("cancels a duplicate snapshot when a parallel start already triggered the collection", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "parallel start", country: "US" });
    const provider = new ScriptedProvider();
    provider.onTrigger = async () => {
      // Simulate the other attempt winning the race for this collection.
      await db
        .update(reportCollection)
        .set({ status: "triggered", snapshotId: "winner" })
        .where(eq(reportCollection.reportId, reportId));
    };
    await handleStart(scriptedDeps(provider), { reportId });
    expect(provider.triggered).toHaveLength(1);
    expect(provider.canceled).toEqual(provider.triggered);
  });

  it("doesn't trigger collections if the report ended during prompt generation", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, {
      type: "visibility",
      website: "https://acme.example",
      brand: "Acme",
      topic: "crm tools",
    });
    const provider = new ScriptedProvider();
    const llm = new FakeLlm();
    const generate = llm.generate.bind(llm);
    llm.generate = (async (request: Parameters<FakeLlm["generate"]>[0]) => {
      const output = await generate(request);
      await failReport(db, reportId, "INTERNAL", "dead-lettered while the model was thinking");
      return output;
    }) as FakeLlm["generate"];
    await handleStart(scriptedDeps(provider, llm), { reportId });
    expect(provider.triggered).toHaveLength(0);
  });

  it("arms the next timeout check before polling, so a failing poll can't end the chain", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "flaky poll", country: "US" });
    const provider = new ScriptedProvider();
    await handleStart(scriptedDeps(provider), { reportId });
    provider.progressError = new Error("Bright Data 503");
    await expect(handleTimeout(scriptedDeps(provider), { reportId, attempt: 1 })).rejects.toThrow("503");
    const next = await db.execute<{ singleton_key: string }>(
      sql`select singleton_key from pgboss.job where name = 'report.timeout' and singleton_key = ${`${reportId}:2`}`,
    );
    expect(next.rows).toHaveLength(1);
  });

  it("gives up after the max wait even when Bright Data can't be polled", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "stuck forever", country: "US" });
    const provider = new ScriptedProvider();
    await handleStart(scriptedDeps(provider), { reportId });
    await db.update(report).set({ startedAt: new Date(Date.now() - 3 * 60 * 60_000) }).where(eq(report.id, reportId));
    provider.progressError = new Error("Bright Data 503");
    await handleTimeout(scriptedDeps(provider), { reportId, attempt: 9 });
    expect(await reportRow(reportId)).toMatchObject({ status: "failed", errorCode: "TIMED_OUT", quotaState: "released" });
    expect(provider.canceled).toEqual(provider.triggered);
  });

  it("fails active reports past the maximum run time even if retries keep them 'fresh'", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "zombie", country: "US" });
    await db
      .update(report)
      .set({ status: "collecting", createdAt: new Date(Date.now() - 4 * 60 * 60_000) })
      .where(eq(report.id, reportId));
    await handleReconcile(deps);
    expect(await reportRow(reportId)).toMatchObject({ status: "failed", errorCode: "TIMED_OUT", quotaState: "released" });
  });

  it("records a snapshot's Bright Data cost once when analysis is retried", async () => {
    const user = await createTestUser(db);
    const reportId = await newReport(user.id, { type: "keyword", keyword: "retried analysis", country: "US" });
    const llm = new FakeLlm();
    const generate = llm.generate.bind(llm);
    let calls = 0;
    llm.generate = (async (request: Parameters<FakeLlm["generate"]>[0]) => {
      calls += 1;
      if (calls === 1) throw new Error("Claude 529 overloaded");
      return generate(request);
    }) as FakeLlm["generate"];
    const flaky: PipelineDeps = { ...deps, providers: { ...deps.providers, llm } };

    await handleStart(flaky, { reportId });
    await handleCollect(flaky, { reportId });
    const analyze = () => runReportJob(flaky, "analyze", reportId, () => handleAnalyze(flaky, { reportId }));
    await expect(analyze()).rejects.toThrow("529");
    await analyze();

    expect((await reportRow(reportId)).status).toBe("completed");
    const usage = await db.select().from(reportUsage).where(eq(reportUsage.reportId, reportId));
    expect(usage.filter((u) => u.provider === "brightdata")).toHaveLength(1);
    expect(await reportCostUsd(db, reportId)).toBeCloseTo(0.0045);
  });

  it("keeps the collect queue out of the dead-letter path", async () => {
    const queue = await boss.getQueue(QUEUES.collect);
    expect(queue?.deadLetter ?? null).toBeNull();
  });
});
