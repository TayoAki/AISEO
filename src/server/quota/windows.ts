/**
 * Pure quota-window math. Free allowances are a single lifetime window; paid
 * allowances reset monthly, anchored to the subscription start (so annual
 * subscribers get twelve monthly allowances, not one).
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

/**
 * Window for a plan. Paid plans without a known period start fall back to the
 * UTC calendar month rather than failing.
 */
export function windowForPlan(plan: PlanId, anchor: Date | null, now: Date): QuotaWindow {
  if (plan === "free") return { start: LIFETIME_WINDOW_START, end: null };
  return monthlyWindow(anchor ?? startOfUtcMonth(now), now);
}
