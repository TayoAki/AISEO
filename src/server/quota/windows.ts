/**
 * Pure quota-window math. Free allowances are a single lifetime window. Paid
 * allowances reset every billing month: monthly plans follow Stripe's own
 * billing period exactly, and annual plans get twelve monthly windows
 * anchored to the start of the billing year.
 */
import type { PlanId } from "../billing/plans";

export type QuotaWindow = { start: Date; end: Date | null };

/** Fixed start for lifetime (free) buckets so the unique key is stable. */
export const LIFETIME_WINDOW_START = new Date(0);

/**
 * Adds calendar months in UTC, clamping the day to the target month's length
 * (Jan 31 + 1 month = Feb 28/29). Always computed from the anchor, never
 * chained, so Jan 31 + 2 months is Mar 31.
 */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const totalMonths = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchor.getUTCDate(), lastDayOfMonth);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

/** The monthly window anchored at `anchor` that contains `now`. */
export function monthlyWindow(anchor: Date, now: Date): QuotaWindow {
  if (now.getTime() < anchor.getTime()) {
    // Clock skew or a just-created subscription: treat as the first window.
    return { start: anchor, end: addMonthsClamped(anchor, 1) };
  }
  let k =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - anchor.getUTCMonth());
  while (k > 0 && addMonthsClamped(anchor, k).getTime() > now.getTime()) k--;
  while (addMonthsClamped(anchor, k + 1).getTime() <= now.getTime()) k++;
  return { start: addMonthsClamped(anchor, k), end: addMonthsClamped(anchor, k + 1) };
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The subscription's current Stripe billing period, as stored by the Stripe plugin. */
export type BillingPeriod = {
  periodStart: Date | null;
  periodEnd: Date | null;
  /** Stripe price interval: "month" or "year". */
  billingInterval: string | null;
};

/**
 * Allowance window for a paid subscription at `now`.
 *
 * - Monthly billing uses Stripe's period as is. Stripe keeps month-end anchors
 *   (Jan 31 -> Feb 28 -> Mar 31), so computing months from the latest period
 *   start would drift and open a second window inside one billing period.
 * - Annual billing gets monthly windows from the start of the billing year,
 *   never extending past its end.
 * - If `now` is past the period end, the renewal hasn't been recorded yet:
 *   the next period starts exactly at the old end, so the window starts there
 *   too and keeps the same bucket once the renewal arrives.
 * - Without a known period, the UTC calendar month is used.
 */
export function paidWindow(period: BillingPeriod | null, now: Date): QuotaWindow {
  const start = period?.periodStart ?? null;
  const end = period?.periodEnd ?? null;
  if (!start) return monthlyWindow(startOfUtcMonth(now), now);

  if (end && end.getTime() > start.getTime()) {
    if (now.getTime() >= end.getTime()) return { start: end, end: addMonthsClamped(end, 1) };
    if (period?.billingInterval !== "year") return { start, end };
  }

  const window = monthlyWindow(start, now);
  if (end && window.end && window.end.getTime() > end.getTime() && window.start.getTime() < end.getTime()) {
    return { start: window.start, end };
  }
  return window;
}

export function windowForPlan(plan: PlanId, period: BillingPeriod | null, now: Date): QuotaWindow {
  if (plan === "free") return { start: LIFETIME_WINDOW_START, end: null };
  return paidWindow(period, now);
}
