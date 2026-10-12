import { and, desc, eq, inArray } from "drizzle-orm";

import type { Executor } from "../db/client";
import { subscription } from "../db/schema";
import { PLANS, type PlanId } from "./plans";

/**
 * Subscription statuses that grant paid access. `past_due` keeps access while
 * Stripe retries the payment; Stripe moves the subscription to `canceled` or
 * `unpaid` if retries fail, which drops the user back to free.
 */
export const PAID_STATUSES = ["active", "trialing", "past_due"] as const;

export type SubscriptionSummary = {
  plan: PlanId;
  status: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  billingInterval: string | null;
  cancelAtPeriodEnd: boolean;
};

export type Entitlements = {
  plan: PlanId;
  isPaid: boolean;
  /** Paid insight sections are generated and returned only when true. */
  insights: boolean;
  subscription: SubscriptionSummary | null;
};

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, plus: 2 };

function asPlanId(value: string): PlanId | null {
  return value === "pro" || value === "plus" ? value : null;
}

export function freeEntitlements(): Entitlements {
  return { plan: "free", isPaid: false, insights: PLANS.free.insights, subscription: null };
}

/** Resolves the user's plan from the Stripe plugin's subscription rows. */
export async function getEntitlements(db: Executor, userId: string): Promise<Entitlements> {
  const rows = await db
    .select({
      plan: subscription.plan,
      status: subscription.status,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      billingInterval: subscription.billingInterval,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    })
    .from(subscription)
    .where(
      and(eq(subscription.referenceId, userId), inArray(subscription.status, [...PAID_STATUSES])),
    )
    .orderBy(desc(subscription.periodStart))
    .limit(5);

  let best: SubscriptionSummary | null = null;
  for (const row of rows) {
    const plan = asPlanId(row.plan);
    if (!plan) continue;
    if (!best || PLAN_RANK[plan] > PLAN_RANK[best.plan]) {
      best = {
        plan,
        status: row.status,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        billingInterval: row.billingInterval,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
      };
    }
  }

  if (!best) return freeEntitlements();
  return { plan: best.plan, isPaid: true, insights: PLANS[best.plan].insights, subscription: best };
}
