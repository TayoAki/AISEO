/**
 * The single source of truth for plans and their allowances. Display prices
 * must match the Stripe prices configured in STRIPE_PRICE_* env vars.
 */
export const FEATURES = ["keyword", "visibility"] as const;
export type Feature = (typeof FEATURES)[number];

export const PLAN_IDS = ["free", "pro", "plus"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = Exclude<PlanId, "free">;

export type PlanDefinition = {
  id: PlanId;
  name: string;
  tagline: string;
  /** "lifetime" allowances never reset; "monthly" reset every month of the subscription. */
  window: "lifetime" | "monthly";
  limits: Record<Feature, number>;
  /** Paid insight sections (strategy, content opportunities, recommendations). */
  insights: boolean;
  priceMonthlyUsd: number;
  priceAnnualUsd: number;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try both reports",
    window: "lifetime",
    limits: { keyword: 2, visibility: 2 },
    insights: false,
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For solo marketers and founders",
    window: "monthly",
    limits: { keyword: 100, visibility: 25 },
    insights: true,
    priceMonthlyUsd: 29,
    priceAnnualUsd: 290,
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "For agencies and growing teams",
    window: "monthly",
    limits: { keyword: 500, visibility: 100 },
    insights: true,
    priceMonthlyUsd: 79,
    priceAnnualUsd: 790,
  },
};

export function isPaidPlan(plan: PlanId): plan is PaidPlanId {
  return plan !== "free";
}

export function featureLabel(feature: Feature): string {
  return feature === "keyword" ? "Keyword reports" : "Visibility scans";
}
