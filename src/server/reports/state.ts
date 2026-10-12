/**
 * The only code allowed to change a report's status. Every write is guarded
 * on the report still being active, so late retries, duplicate webhooks and
 * the reconciler can never resurrect or overwrite a finished report.
 */
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database, Executor } from "../db/client";
import { report } from "../db/schema";
import { FAILURE_MESSAGES, type FailureCode } from "../pipeline/errors";
import { settleReservation } from "../quota/quota";
import { RESULT_VERSION } from "./results";

export const ACTIVE_STATUSES = ["queued", "collecting", "analyzing"] as const;
export const TERMINAL_STATUSES = ["completed", "failed", "canceled"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];
export type ReportStatus = ActiveStatus | (typeof TERMINAL_STATUSES)[number];

export const REPORT_UPDATES_CHANNEL = "report_updates";

export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Delivered to LISTENers only when the surrounding transaction commits. */
export async function notifyReport(db: Executor, reportId: string): Promise<void> {
  await db.execute(sql`select pg_notify(${REPORT_UPDATES_CHANNEL}, ${reportId})`);
}

export type Advance = {
  status: ActiveStatus;
  progress: number;
  step: string;
  markStarted?: boolean;
};

/** Moves an active report forward. Progress never goes backwards. */
export async function advanceReport(db: Executor, reportId: string, update: Advance): Promise<boolean> {
  const rows = await db
    .update(report)
    .set({
      status: update.status,
      step: update.step,
      progress: sql`greatest(${report.progress}, ${update.progress})`,
      ...(update.markStarted ? { startedAt: sql`coalesce(${report.startedAt}, now())` } : {}),
    })
    .where(and(eq(report.id, reportId), inArray(report.status, [...ACTIVE_STATUSES])))
    .returning({ id: report.id });
  if (rows.length === 0) return false;
  await notifyReport(db, reportId);
  return true;
}

/** Completes an active report and commits its quota reservation atomically. */
export async function completeReport(db: Database, reportId: string, result: unknown): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(report)
      .set({
        status: "completed",
        progress: 100,
        step: "Report ready",
        result,
        resultVersion: RESULT_VERSION,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      })
      .where(and(eq(report.id, reportId), inArray(report.status, [...ACTIVE_STATUSES])))
      .returning({ id: report.id });
    if (rows.length === 0) return false;
    await settleReservation(tx, reportId, "commit");
    await notifyReport(tx, reportId);
    return true;
  });
}

/**
 * Fails (or cancels) an active report and releases its reservation. Safe to
 * call repeatedly; returns true only for the call that changed the status.
 */
export async function failReport(
  db: Database,
  reportId: string,
  code: FailureCode,
  detail: string,
  status: "failed" | "canceled" = "failed",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(report)
      .set({
        status,
        step: status === "canceled" ? "Canceled" : "Failed",
        errorCode: code,
        errorMessage: FAILURE_MESSAGES[code],
        failureDetail: detail.slice(0, 4000),
        completedAt: new Date(),
      })
      .where(and(eq(report.id, reportId), inArray(report.status, [...ACTIVE_STATUSES])))
      .returning({ id: report.id });
    // Releasing is idempotent and a no-op for completed (committed) reports.
    const released = await settleReservation(tx, reportId, "release");
    if (rows.length > 0 || released) await notifyReport(tx, reportId);
    return rows.length > 0;
  });
}
