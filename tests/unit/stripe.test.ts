import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { subscriptionFields } from "@/server/billing/stripe-events";

function liveSubscription(overrides: Partial<Stripe.Subscription> = {}, priceId = "price_plus_monthly"): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    items: {
      data: [
        {
          price: { id: priceId, recurring: { interval: "month" } },
          current_period_start: 1_772_236_800, // 2026-02-28T00:00:00Z
          current_period_end: 1_774_915_200, // 2026-03-31T00:00:00Z
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

const planOf = (priceId: string) => (priceId === "price_plus_monthly" ? "plus" : null) as "plus" | null;

describe("subscriptionFields", () => {
  it("mirrors Stripe's current status, period, interval and plan", () => {
    const fields = subscriptionFields(liveSubscription(), planOf);
    expect(fields.status).toBe("active");
    expect(fields.periodStart?.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(fields.periodEnd?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(fields.billingInterval).toBe("month");
    expect(fields.plan).toBe("plus");
  });

  it("records scheduled and completed cancellations", () => {
    const fields = subscriptionFields(
      liveSubscription({ status: "canceled", cancel_at: 1_774_915_200, canceled_at: 1_773_000_000, ended_at: 1_774_915_200 }),
      planOf,
    );
    expect(fields.status).toBe("canceled");
    expect(fields.cancelAt?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(fields.endedAt?.toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("leaves the plan alone for prices it doesn't know", () => {
    const fields = subscriptionFields(liveSubscription({}, "price_unknown"), planOf);
    expect("plan" in fields).toBe(false);
  });
});
