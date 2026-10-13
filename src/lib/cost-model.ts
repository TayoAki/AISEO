/**
 * Unit economics for the admin cost page: what a customer pays, what serving
 * them costs, and the margin left. Pure functions shared by the server page
 * and the what-if calculator in the browser.
 *
 * The assumptions are list prices. Update them when Stripe's or your hosting
 * prices change; measured report costs come from report_usage instead.
 */
import { PLANS, type Feature, type PaidPlanId } from "@/server/billing/plans";

export type BillingInterval = "month" | "year";
export type PlanKey = `${PaidPlanId}_${BillingInterval}`;
export type FeatureCosts = Record<Feature, number>;

export const PLAN_KEYS: readonly PlanKey[] = ["pro_month", "pro_year", "plus_month", "plus_year"];

export const COST_ASSUMPTIONS = {
  /** US online cards (2.9% + 30¢ per charge) plus Stripe Billing (0.7% of subscription volume). */
  stripe: { percent: 0.029, fixedUsd: 0.3, billingPercent: 0.007 },
  /** Railway Hobby ($5 including $5 of usage); Resend and Turnstile are free at launch volumes. */
  fixedMonthlyUsd: 5,
  /** Per-report cost before real reports are measured (Claude Sonnet 5.5 and Bright Data list prices). */
  estimatedReportCostUsd: { keyword: 0.06, visibility: 0.09 } satisfies FeatureCosts,
  /** Share of the monthly allowance a typical subscriber uses, before it is measured. */
  estimatedUtilization: 0.3,
} as const;

export function planKey(plan: PaidPlanId, interval: BillingInterval): PlanKey {
  return `${plan}_${interval}`;
}

export function parsePlanKey(key: PlanKey): { plan: PaidPlanId; interval: BillingInterval } {
  const [plan, interval] = key.split("_") as [PaidPlanId, BillingInterval];
  return { plan, interval };
}

/** What one subscriber pays per month (annual plans spread over 12 months). */
export function monthlyRevenue(plan: PaidPlanId, interval: BillingInterval): number {
  return interval === "year" ? PLANS[plan].priceAnnualUsd / 12 : PLANS[plan].priceMonthlyUsd;
}

/** Stripe fees for one subscriber, per month (an annual plan pays one charge a year). */
export function stripeFeesPerMonth(
  plan: PaidPlanId,
  interval: BillingInterval,
  stripe: { percent: number; fixedUsd: number; billingPercent: number } = COST_ASSUMPTIONS.stripe,
): number {
  const charge = interval === "year" ? PLANS[plan].priceAnnualUsd : PLANS[plan].priceMonthlyUsd;
  const perCharge = charge * (stripe.percent + stripe.billingPercent) + stripe.fixedUsd;
  return interval === "year" ? perCharge / 12 : perCharge;
}

/** Report cost of one subscriber using `utilization` (0 to 1) of each monthly allowance. */
export function usageCostPerMonth(
  plan: PaidPlanId,
  costPerReport: FeatureCosts,
  utilization: number | FeatureCosts,
): number {
  const share = typeof utilization === "number" ? { keyword: utilization, visibility: utilization } : utilization;
  const { limits } = PLANS[plan];
  return limits.keyword * costPerReport.keyword * share.keyword + limits.visibility * costPerReport.visibility * share.visibility;
}

export type PlanEconomics = {
  plan: PaidPlanId;
  interval: BillingInterval;
  revenue: number;
  stripeFees: number;
  usageCost: number;
  fullUsageCost: number;
  /** Gross margin at the given utilization, as a fraction of revenue. */
  margin: number;
  /** Gross margin if the subscriber uses the whole allowance. */
  fullUsageMargin: number;
};

/** Monthly economics of one subscriber (fixed costs excluded). */
export function planEconomics(
  plan: PaidPlanId,
  interval: BillingInterval,
  costPerReport: FeatureCosts,
  utilization: number | FeatureCosts,
): PlanEconomics {
  const revenue = monthlyRevenue(plan, interval);
  const stripeFees = stripeFeesPerMonth(plan, interval);
  const usageCost = usageCostPerMonth(plan, costPerReport, utilization);
  const fullUsageCost = usageCostPerMonth(plan, costPerReport, 1);
  return {
    plan,
    interval,
    revenue,
    stripeFees,
    usageCost,
    fullUsageCost,
    margin: (revenue - stripeFees - usageCost) / revenue,
    fullUsageMargin: (revenue - stripeFees - fullUsageCost) / revenue,
  };
}

/** Cost of a free signup who uses `share` (0 to 1) of the one-time free allowance. */
export function freeSignupCost(costPerReport: FeatureCosts, share: number): number {
  const { limits } = PLANS.free;
  return (limits.keyword * costPerReport.keyword + limits.visibility * costPerReport.visibility) * share;
}

export type ScenarioInput = {
  customers: Record<PlanKey, number>;
  /** Share (0 to 1) of the monthly allowance subscribers use. */
  utilization: number;
  freeSignupsPerMonth: number;
  /** Share (0 to 1) of the free allowance a new signup uses. */
  freeUsageShare: number;
  /** Cost of a paid report (paid reports include the AI insight sections). */
  paidCostPerReport: FeatureCosts;
  freeCostPerReport: FeatureCosts;
  fixedMonthlyUsd: number;
};

export type ScenarioResult = {
  payingCustomers: number;
  revenue: number;
  paidUsageCost: number;
  stripeFees: number;
  freeCost: number;
  fixedCost: number;
  totalCost: number;
  grossProfit: number;
  /** Null without revenue. */
  margin: number | null;
};

/** A month of the business: revenue, every cost line and the gross margin. */
export function runScenario(input: ScenarioInput): ScenarioResult {
  let payingCustomers = 0;
  let revenue = 0;
  let paidUsageCost = 0;
  let stripeFees = 0;
  for (const key of PLAN_KEYS) {
    const count = Math.max(0, input.customers[key] ?? 0);
    if (count === 0) continue;
    const { plan, interval } = parsePlanKey(key);
    payingCustomers += count;
    revenue += count * monthlyRevenue(plan, interval);
    stripeFees += count * stripeFeesPerMonth(plan, interval);
    paidUsageCost += count * usageCostPerMonth(plan, input.paidCostPerReport, input.utilization);
  }
  const freeCost = Math.max(0, input.freeSignupsPerMonth) * freeSignupCost(input.freeCostPerReport, input.freeUsageShare);
  const fixedCost = Math.max(0, input.fixedMonthlyUsd);
  const totalCost = paidUsageCost + stripeFees + freeCost + fixedCost;
  const grossProfit = revenue - totalCost;
  return {
    payingCustomers,
    revenue,
    paidUsageCost,
    stripeFees,
    freeCost,
    fixedCost,
    totalCost,
    grossProfit,
    margin: revenue > 0 ? grossProfit / revenue : null,
  };
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdUnit = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** Amounts: "$12.34" under $100, "$1,234" from there. */
export function formatUsd(value: number): string {
  return Math.abs(value) < 100 ? usdCents.format(value) : usd.format(value);
}

/** Per-report costs, always to four decimals: "$0.0612". */
export function formatUnitCost(value: number): string {
  return usdUnit.format(value);
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null || !Number.isFinite(fraction)) return "–";
  return `${Math.round(fraction * 100)}%`;
}
