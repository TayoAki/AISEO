import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { fromDrizzle, type PgBoss } from "pg-boss";

import { reportTitle, type ReportInput } from "@/lib/report-input";

import type { Entitlements } from "../billing/entitlements";
import type { Feature } from "../billing/plans";
import type { Database } from "../db/client";
import { report } from "../db/schema";
import { INPUT_FAILURE_CODES } from "../pipeline/errors";
import { QUEUES, type ReportJobData } from "../pipeline/queues";
import { ensureBucket, quotaTarget, reserveUnit } from "../quota/quota";
import { ACTIVE_STATUSES, notifyReport } from "./state";

export type CreateReportArgs = {
  userId: string;
  input: ReportInput;
  idempotencyKey: string;
  entitlements: Entitlements;
  now: Date;
  maxActiveReports: number;
  /** Input-caused failures allowed per rolling 24 hours (see INPUT_FAILURE_CODES). */
  maxFailedReportsPerDay?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type CreateReportResult =
  | { status: "created"; reportId: string }
  | { status: "duplicate"; reportId: string }
  | { status: "limit_reached"; feature: Feature }
  | { status: "too_many_active"; limit: number }
  | { status: "too_many_failures"; limit: number };

/**
 * Creates a report in one transaction: per-user advisory lock, idempotency
 * check, active-report cap, quota reservation, the report row and its first
 * pipeline job. Either all of it commits or none of it does, so a crash can
 * never leave a reserved credit without a job, or a job without a report.
 */
export async function createReport(
  deps: { db: Database; boss: PgBoss },
  args: CreateReportArgs,
): Promise<CreateReportResult> {
  const feature: Feature = args.input.type;

  return deps.db.transaction(async (tx) => {
    // Serialize report creation per user (cheap, and makes the caps exact).
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`report-create:${args.userId}`}, 0))`);

    const [existing] = await tx
      .select({ id: report.id })
      .from(report)
      .where(and(eq(report.userId, args.userId), eq(report.idempotencyKey, args.idempotencyKey)))
      .limit(1);
    if (existing) return { status: "duplicate", reportId: existing.id };

    const [active] = await tx
      .select({ value: count() })
      .from(report)
      .where(and(eq(report.userId, args.userId), inArray(report.status, [...ACTIVE_STATUSES])));
    if ((active?.value ?? 0) >= args.maxActiveReports) {
      return { status: "too_many_active", limit: args.maxActiveReports };
    }

    const failureLimit = args.maxFailedReportsPerDay ?? 5;
    const [failures] = await tx
      .select({ value: count() })
      .from(report)
      .where(
        and(
          eq(report.userId, args.userId),
          eq(report.status, "failed"),
          inArray(report.errorCode, [...INPUT_FAILURE_CODES]),
          gt(report.createdAt, new Date(args.now.getTime() - DAY_MS)),
        ),
      );
    if ((failures?.value ?? 0) >= failureLimit) return { status: "too_many_failures", limit: failureLimit };

    const bucketId = await ensureBucket(tx, quotaTarget(args.userId, feature, args.entitlements, args.now));
    if (!(await reserveUnit(tx, bucketId))) return { status: "limit_reached", feature };

    const [created] = await tx
      .insert(report)
      .values({
        userId: args.userId,
        type: args.input.type,
        status: "queued",
        progress: 5,
        step: "Queued",
        title: reportTitle(args.input),
        input: args.input,
        tier: args.entitlements.plan,
        usageBucketId: bucketId,
        idempotencyKey: args.idempotencyKey,
      })
      .returning({ id: report.id });
    if (!created) throw new Error("report insert returned no row");

    const job: ReportJobData = { reportId: created.id };
    const jobId = await deps.boss.send(QUEUES.start, job, {
      singletonKey: created.id,
      db: fromDrizzle(tx, sql),
    });
    if (!jobId) throw new Error("pipeline start job was not created");

    await notifyReport(tx, created.id);
    return { status: "created", reportId: created.id };
  });
}
