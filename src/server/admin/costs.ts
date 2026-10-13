/**
 * Cost and revenue aggregates for the admin cost page (/admin/costs). These
 * queries read across all users on purpose: only pages guarded by
 * requireAdmin() may call them, and they return aggregates, never report
 * content.
 */
import { and, gt, inArray, isNull, or, sql } from "drizzle-orm";

import {
  COST_ASSUMPTIONS,
  monthlyRevenue,
  PLAN_KEYS,
  planKey,
  stripeFeesPerMonth,
  type BillingInterval,
  type FeatureCosts,
  type PlanKey,
} from "@/lib/cost-model";

import { PAID_STATUSES, PERIOD_END_GRACE_MS } from "../billing/entitlements";
import { FEATURES, PLANS, type Feature, type PaidPlanId, type PlanId } from "../billing/plans";
import type { Executor } from "../db/client";
import { subscription } from "../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const usd = (micros: number | null | undefined) => (micros ?? 0) / 1_000_000;

export type CostPeriod = { days: number; since: Date; until: Date };

export function costPeriod(days: number, now = new Date()): CostPeriod {
  return { days, since: new Date(now.getTime() - days * DAY_MS), until: now };
}

export type ProviderSpend = { provider: string; calls: number; usd: number; unpricedCalls: number };

export type TaskSpend = {
  provider: string;
  task: string;
  model: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  records: number;
  usd: number;
  unpricedCalls: number;
};

/** Reports created in the period, grouped by type and the plan they ran on. */
export type ReportGroupCosts = {
  type: Feature;
  tier: PlanId;
  reports: number;
  completed: number;
  failed: number;
  /** Average recorded cost of a completed report. */
  avgCompletedUsd: number | null;
  p90CompletedUsd: number | null;
  /** Everything these reports cost, failed ones included. */
  totalUsd: number;
  failedUsd: number;
};

/** All-in cost per delivered report: spend on every report (failed ones too) divided by completed ones. */
export type DeliveredCost = { usd: number; completed: number; measured: boolean };

export type TopUser = { userId: string; email: string; tiers: string[]; reports: number; usd: number };

export type CostOverview = {
  period: CostPeriod;
  spend: { totalUsd: number; byProvider: ProviderSpend[]; unpricedCalls: number };
  tasks: TaskSpend[];
  reportGroups: ReportGroupCosts[];
  failedReportsUsd: number;
  costPerReport: { paid: Record<Feature, DeliveredCost>; free: Record<Feature, DeliveredCost> };
  subscribers: { counts: Record<PlanKey, number>; payingCustomers: number; mrrUsd: number; stripeFeesPerMonthUsd: number };
  /** Completed reports per subscriber per 30 days, as a share of the allowance (null without subscribers). */
  utilization: Record<PaidPlanId, Record<Feature, number | null>>;
  /** Cost-weighted share of paid allowances used, or the estimate when nothing is measured yet. */
  overallUtilization: { value: number; measured: boolean };
  free: { signups: number; usersWithReports: number; reports: number; usd: number };
  topUsers: TopUser[];
  /** Estimated gross margin over the period, or null without revenue. */
  periodRevenueUsd: number;
  periodMargin: number | null;
};

const PLAN_RANK: Record<PaidPlanId, number> = { pro: 1, plus: 2 };

/** Current paying subscribers per plan and interval, one per user (their best plan), like getEntitlements. */
async function payingSubscribers(db: Executor, now: Date): Promise<Record<PlanKey, number>> {
  const rows = await db
    .select({ userId: subscription.referenceId, plan: subscription.plan, interval: subscription.billingInterval })
    .from(subscription)
    .where(
      and(
        inArray(subscription.status, [...PAID_STATUSES]),
        or(isNull(subscription.periodEnd), gt(subscription.periodEnd, new Date(now.getTime() - PERIOD_END_GRACE_MS))),
      ),
    );

  const best = new Map<string, { plan: PaidPlanId; interval: BillingInterval }>();
  for (const row of rows) {
    if (row.plan !== "pro" && row.plan !== "plus") continue;
    const interval: BillingInterval = row.interval === "year" ? "year" : "month";
    const current = best.get(row.userId);
    if (!current || PLAN_RANK[row.plan] > PLAN_RANK[current.plan]) best.set(row.userId, { plan: row.plan, interval });
  }

  const counts = Object.fromEntries(PLAN_KEYS.map((key) => [key, 0])) as Record<PlanKey, number>;
  for (const { plan, interval } of best.values()) counts[planKey(plan, interval)] += 1;
  return counts;
}

function deliveredCost(groups: ReportGroupCosts[], type: Feature, paid: boolean): DeliveredCost {
  const matching = groups.filter((g) => g.type === type && (g.tier !== "free") === paid);
  const completed = matching.reduce((sum, g) => sum + g.completed, 0);
  const total = matching.reduce((sum, g) => sum + g.totalUsd, 0);
  if (completed === 0) return { usd: COST_ASSUMPTIONS.estimatedReportCostUsd[type], completed: 0, measured: false };
  return { usd: total / completed, completed, measured: true };
}

export async function getCostOverview(db: Executor, period: CostPeriod): Promise<CostOverview> {
  const { since, until, days } = period;

  const providerRows = await db.execute<{ provider: string; calls: number; micros: number; unpriced: number }>(sql`
    select provider, count(*)::int as calls, coalesce(sum(cost_micros), 0)::float8 as micros,
           (count(*) filter (where cost_micros is null))::int as unpriced
    from report_usage
    where created_at >= ${since} and created_at < ${until}
    group by provider
    order by micros desc`);
  const byProvider: ProviderSpend[] = providerRows.rows.map((r) => ({
    provider: r.provider,
    calls: r.calls,
    usd: usd(r.micros),
    unpricedCalls: r.unpriced,
  }));

  const taskRows = await db.execute<{
    provider: string;
    task: string;
    model: string | null;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    records: number;
    micros: number;
    unpriced: number;
  }>(sql`
    select provider, task, model, count(*)::int as calls,
           coalesce(sum(input_tokens), 0)::float8 as input_tokens,
           coalesce(sum(output_tokens), 0)::float8 as output_tokens,
           coalesce(sum(records), 0)::float8 as records,
           coalesce(sum(cost_micros), 0)::float8 as micros,
           (count(*) filter (where cost_micros is null))::int as unpriced
    from report_usage
    where created_at >= ${since} and created_at < ${until}
    group by provider, task, model
    order by micros desc, calls desc`);
  const tasks: TaskSpend[] = taskRows.rows.map((r) => ({
    provider: r.provider,
    task: r.task,
    model: r.model,
    calls: r.calls,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    records: r.records,
    usd: usd(r.micros),
    unpricedCalls: r.unpriced,
  }));

  const groupRows = await db.execute<{
    type: Feature;
    tier: PlanId;
    reports: number;
    completed: number;
    failed: number;
    avg_completed: number | null;
    p90_completed: number | null;
    total: number;
    failed_total: number;
  }>(sql`
    with per_report as (
      select r.id, r.type, r.tier, r.status, coalesce(sum(u.cost_micros), 0)::float8 as micros
      from report r
      left join report_usage u on u.report_id = r.id
      where r.created_at >= ${since} and r.created_at < ${until}
      group by r.id
    )
    select type, tier, count(*)::int as reports,
           (count(*) filter (where status = 'completed'))::int as completed,
           (count(*) filter (where status = 'failed'))::int as failed,
           (avg(micros) filter (where status = 'completed'))::float8 as avg_completed,
           (percentile_cont(0.9) within group (order by micros) filter (where status = 'completed'))::float8 as p90_completed,
           coalesce(sum(micros), 0)::float8 as total,
           coalesce(sum(micros) filter (where status = 'failed'), 0)::float8 as failed_total
    from per_report
    group by type, tier
    order by type, tier`);
  const reportGroups: ReportGroupCosts[] = groupRows.rows.map((r) => ({
    type: r.type,
    tier: r.tier,
    reports: r.reports,
    completed: r.completed,
    failed: r.failed,
    avgCompletedUsd: r.avg_completed === null ? null : usd(r.avg_completed),
    p90CompletedUsd: r.p90_completed === null ? null : usd(r.p90_completed),
    totalUsd: usd(r.total),
    failedUsd: usd(r.failed_total),
  }));

  const topRows = await db.execute<{ user_id: string; email: string; tiers: string[]; reports: number; micros: number }>(sql`
    select r.user_id, u.email, array_agg(distinct r.tier::text) as tiers,
           count(distinct r.id)::int as reports, coalesce(sum(us.cost_micros), 0)::float8 as micros
    from report_usage us
    join report r on r.id = us.report_id
    join "user" u on u.id = r.user_id
    where us.created_at >= ${since} and us.created_at < ${until}
    group by r.user_id, u.email
    order by micros desc
    limit 10`);
  const topUsers: TopUser[] = topRows.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    tiers: r.tiers,
    reports: r.reports,
    usd: usd(r.micros),
  }));

  const freeRows = await db.execute<{ signups: number; users_with_reports: number }>(sql`
    select
      (select count(*)::int from "user" where created_at >= ${since} and created_at < ${until}) as signups,
      (select count(distinct user_id)::int from report
        where tier = 'free' and created_at >= ${since} and created_at < ${until}) as users_with_reports`);
  const freeCounts = freeRows.rows[0] ?? { signups: 0, users_with_reports: 0 };

  const counts = await payingSubscribers(db, until);
  let payingCustomers = 0;
  let mrrUsd = 0;
  let stripeFeesPerMonthUsd = 0;
  for (const key of PLAN_KEYS) {
    const [plan, interval] = key.split("_") as [PaidPlanId, BillingInterval];
    payingCustomers += counts[key];
    mrrUsd += counts[key] * monthlyRevenue(plan, interval);
    stripeFeesPerMonthUsd += counts[key] * stripeFeesPerMonth(plan, interval);
  }

  const costPerReport = {
    paid: { keyword: deliveredCost(reportGroups, "keyword", true), visibility: deliveredCost(reportGroups, "visibility", true) },
    free: { keyword: deliveredCost(reportGroups, "keyword", false), visibility: deliveredCost(reportGroups, "visibility", false) },
  };

  // Completed reports per subscriber, scaled to 30 days, against the plan's allowance.
  const scale = 30 / days;
  const utilization = {} as Record<PaidPlanId, Record<Feature, number | null>>;
  let usedCost = 0;
  let allowanceCost = 0;
  for (const plan of ["pro", "plus"] as const) {
    const subscribers = counts[planKey(plan, "month")] + counts[planKey(plan, "year")];
    utilization[plan] = { keyword: null, visibility: null };
    for (const feature of FEATURES) {
      if (subscribers === 0) continue;
      const completed = reportGroups.find((g) => g.type === feature && g.tier === plan)?.completed ?? 0;
      const allowance = subscribers * PLANS[plan].limits[feature];
      utilization[plan][feature] = (completed * scale) / allowance;
      usedCost += completed * scale * costPerReport.paid[feature].usd;
      allowanceCost += allowance * costPerReport.paid[feature].usd;
    }
  }
  const overallUtilization =
    allowanceCost > 0
      ? { value: usedCost / allowanceCost, measured: true }
      : { value: COST_ASSUMPTIONS.estimatedUtilization, measured: false };

  const freeGroups = reportGroups.filter((g) => g.tier === "free");
  const totalUsd = byProvider.reduce((sum, p) => sum + p.usd, 0);
  const periodRevenueUsd = (mrrUsd * days) / 30;
  const periodCosts = totalUsd + (stripeFeesPerMonthUsd * days) / 30 + (COST_ASSUMPTIONS.fixedMonthlyUsd * days) / 30;

  return {
    period,
    spend: { totalUsd, byProvider, unpricedCalls: byProvider.reduce((sum, p) => sum + p.unpricedCalls, 0) },
    tasks,
    reportGroups,
    failedReportsUsd: reportGroups.reduce((sum, g) => sum + g.failedUsd, 0),
    costPerReport,
    subscribers: { counts, payingCustomers, mrrUsd, stripeFeesPerMonthUsd },
    utilization,
    overallUtilization,
    free: {
      signups: freeCounts.signups,
      usersWithReports: freeCounts.users_with_reports,
      reports: freeGroups.reduce((sum, g) => sum + g.reports, 0),
      usd: freeGroups.reduce((sum, g) => sum + g.totalUsd, 0),
    },
    topUsers,
    periodRevenueUsd,
    periodMargin: periodRevenueUsd > 0 ? (periodRevenueUsd - periodCosts) / periodRevenueUsd : null,
  };
}

/** Per-report costs for the calculator: measured where available, estimated otherwise. */
export function costsForModel(overview: CostOverview): { paid: FeatureCosts; free: FeatureCosts } {
  return {
    paid: { keyword: overview.costPerReport.paid.keyword.usd, visibility: overview.costPerReport.paid.visibility.usd },
    free: { keyword: overview.costPerReport.free.keyword.usd, visibility: overview.costPerReport.free.visibility.usd },
  };
}
