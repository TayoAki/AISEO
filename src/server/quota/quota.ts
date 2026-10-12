/**
 * Race-free usage quotas.
 *
 * Every report reserves one unit of its feature's current bucket before any
 * money is spent. The reservation is a single conditional UPDATE: under READ
 * COMMITTED a concurrent writer waits for the row lock and then re-evaluates
 * the WHERE clause, so `used + reserved` can never exceed `quota` (a CHECK
 * constraint backs this up). The reservation is later committed (report
 * completed) or released (report failed), exactly once, guarded by the
 * report's `quota_state`.
 */
import { and, eq, sql } from "drizzle-orm";

import type { Entitlements } from "../billing/entitlements";
import { FEATURES, PLANS, type Feature, type PlanId } from "../billing/plans";
import type { Executor } from "../db/client";
import { report, usageBucket } from "../db/schema";
import { windowForPlan, type QuotaWindow } from "./windows";

export type QuotaTarget = {
  userId: string;
  feature: Feature;
  plan: PlanId;
  window: QuotaWindow;
  quota: number;
};

/** Which bucket a new report for `feature` should draw from right now. */
export function quotaTarget(
  userId: string,
  feature: Feature,
  entitlements: Entitlements,
  now: Date,
): QuotaTarget {
  const plan = entitlements.plan;
  const anchor = entitlements.subscription?.periodStart ?? null;
  return {
    userId,
    feature,
    plan,
    window: windowForPlan(plan, anchor, now),
    quota: PLANS[plan].limits[feature],
  };
}

/** Returns the bucket id for the target window, creating the bucket if needed. */
export async function ensureBucket(db: Executor, target: QuotaTarget): Promise<string> {
  const inserted = await db
    .insert(usageBucket)
    .values({
      userId: target.userId,
      feature: target.feature,
      plan: target.plan,
      windowStart: target.window.start,
      windowEnd: target.window.end,
      quota: target.quota,
    })
    .onConflictDoNothing({
      target: [usageBucket.userId, usageBucket.feature, usageBucket.plan, usageBucket.windowStart],
    })
    .returning({ id: usageBucket.id });
  if (inserted[0]) return inserted[0].id;

  const [existing] = await db
    .select({ id: usageBucket.id })
    .from(usageBucket)
    .where(
      and(
        eq(usageBucket.userId, target.userId),
        eq(usageBucket.feature, target.feature),
        eq(usageBucket.plan, target.plan),
        eq(usageBucket.windowStart, target.window.start),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("usage bucket vanished after conflict");
  return existing.id;
}

/** Atomically takes one unit from the bucket. False when the allowance is used up. */
export async function reserveUnit(db: Executor, bucketId: string): Promise<boolean> {
  const rows = await db
    .update(usageBucket)
    .set({ reserved: sql`${usageBucket.reserved} + 1` })
    .where(
      and(
        eq(usageBucket.id, bucketId),
        sql`${usageBucket.used} + ${usageBucket.reserved} < ${usageBucket.quota}`,
      ),
    )
    .returning({ id: usageBucket.id });
  return rows.length === 1;
}

export type SettleOutcome = "commit" | "release";

/**
 * Settles a report's reservation exactly once. Returns false if it was
 * already settled (safe to call from retries, timeouts and the reconciler).
 */
export async function settleReservation(
  db: Executor,
  reportId: string,
  outcome: SettleOutcome,
): Promise<boolean> {
  const settled = await db
    .update(report)
    .set({ quotaState: outcome === "commit" ? "committed" : "released" })
    .where(and(eq(report.id, reportId), eq(report.quotaState, "reserved")))
    .returning({ bucketId: report.usageBucketId });
  const row = settled[0];
  if (!row) return false;

  await db
    .update(usageBucket)
    .set(
      outcome === "commit"
        ? { reserved: sql`${usageBucket.reserved} - 1`, used: sql`${usageBucket.used} + 1` }
        : { reserved: sql`${usageBucket.reserved} - 1` },
    )
    .where(eq(usageBucket.id, row.bucketId));
  return true;
}

export type FeatureUsage = {
  feature: Feature;
  plan: PlanId;
  quota: number;
  used: number;
  reserved: number;
  remaining: number;
  /** Null for lifetime (free) allowances. */
  resetsAt: Date | null;
};

/** Current allowance per feature for display (dashboard, billing, forms). */
export async function getUsageSummary(
  db: Executor,
  userId: string,
  entitlements: Entitlements,
  now: Date,
): Promise<Record<Feature, FeatureUsage>> {
  const summary = {} as Record<Feature, FeatureUsage>;
  for (const feature of FEATURES) {
    const target = quotaTarget(userId, feature, entitlements, now);
    const [bucket] = await db
      .select({ used: usageBucket.used, reserved: usageBucket.reserved, quota: usageBucket.quota })
      .from(usageBucket)
      .where(
        and(
          eq(usageBucket.userId, userId),
          eq(usageBucket.feature, feature),
          eq(usageBucket.plan, target.plan),
          eq(usageBucket.windowStart, target.window.start),
        ),
      )
      .limit(1);
    const quota = bucket?.quota ?? target.quota;
    const used = bucket?.used ?? 0;
    const reserved = bucket?.reserved ?? 0;
    summary[feature] = {
      feature,
      plan: target.plan,
      quota,
      used,
      reserved,
      remaining: Math.max(quota - used - reserved, 0),
      resetsAt: target.window.end,
    };
  }
  return summary;
}
