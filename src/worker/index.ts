/**
 * Pipeline worker: a long-running process (its own Railway service) that
 * runs the report jobs. Start with `npm run dev:worker` locally or
 * `node dist/worker.js` in production.
 */
import { getDb, getPool } from "../server/db/client";
import { assertProductionConfig, getEnv } from "../server/env";
import { createBoss } from "../server/pipeline/boss";
import {
  handleAnalyze,
  handleCollect,
  handleDeadLetter,
  handleReconcile,
  handleStart,
  handleTimeout,
  runReportJob,
  type PipelineDeps,
} from "../server/pipeline/jobs";
import { createProviders } from "../server/pipeline/providers";
import {
  ensureQueues,
  QUEUES,
  RECONCILE_CRON,
  type ReportJobData,
  type TimeoutJobData,
} from "../server/pipeline/queues";

async function main(): Promise<void> {
  const env = getEnv();
  assertProductionConfig("worker", env);
  const boss = createBoss("worker");
  await boss.start();
  await ensureQueues(boss);

  const deps: PipelineDeps = { db: getDb(), boss, providers: createProviders(env), env };
  const options = { localConcurrency: env.WORKER_CONCURRENCY, batchSize: 1 };

  await boss.work<ReportJobData>(QUEUES.start, options, async ([job]) => {
    if (job) await runReportJob(deps, "start", job.data.reportId, () => handleStart(deps, job.data));
  });
  await boss.work<ReportJobData>(QUEUES.collect, options, async ([job]) => {
    if (job) await runReportJob(deps, "collect", job.data.reportId, () => handleCollect(deps, job.data));
  });
  await boss.work<ReportJobData>(QUEUES.analyze, { ...options, localConcurrency: Math.max(1, Math.floor(env.WORKER_CONCURRENCY / 2)) }, async ([job]) => {
    if (job) await runReportJob(deps, "analyze", job.data.reportId, () => handleAnalyze(deps, job.data));
  });
  await boss.work<TimeoutJobData>(QUEUES.timeout, options, async ([job]) => {
    if (job) await runReportJob(deps, "timeout", job.data.reportId, () => handleTimeout(deps, job.data));
  });
  await boss.work<ReportJobData>(QUEUES.failed, { batchSize: 1 }, async ([job]) => {
    if (job) await handleDeadLetter(deps, job.data);
  });
  await boss.work(QUEUES.reconcile, { batchSize: 1 }, async () => {
    await handleReconcile(deps);
  });
  await boss.schedule(QUEUES.reconcile, RECONCILE_CRON, {}, { tz: "UTC" });

  console.info("[worker] ready", {
    providers: env.PROVIDER_MODE,
    model: env.PROVIDER_MODE === "live" ? env.ANTHROPIC_MODEL : "fake",
    concurrency: env.WORKER_CONCURRENCY,
  });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.info(`[worker] ${signal} received, draining jobs`);
    try {
      await boss.stop({ graceful: true, timeout: 25_000 });
      await getPool().end();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  console.error("[worker] failed to start", error);
  process.exit(1);
});
