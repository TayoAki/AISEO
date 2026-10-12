import { describe, expect, it } from "vitest";

import {
  addMonthsClamped,
  LIFETIME_WINDOW_START,
  monthlyWindow,
  paidWindow,
  startOfUtcMonth,
  windowForPlan,
} from "@/server/quota/windows";

const d = (iso: string) => new Date(iso);

describe("addMonthsClamped", () => {
  it("adds months keeping the time of day", () => {
    expect(addMonthsClamped(d("2026-01-15T10:30:00Z"), 1).toISOString()).toBe("2026-02-15T10:30:00.000Z");
  });

  it("clamps to the end of shorter months", () => {
    expect(addMonthsClamped(d("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonthsClamped(d("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("computes from the anchor instead of chaining, so the day recovers", () => {
    expect(addMonthsClamped(d("2026-01-31T00:00:00Z"), 2).toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("crosses year boundaries", () => {
    expect(addMonthsClamped(d("2026-11-30T00:00:00Z"), 3).toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });
});

describe("monthlyWindow", () => {
  const anchor = d("2026-01-31T12:00:00Z");

  it("returns the first window right after the anchor", () => {
    const w = monthlyWindow(anchor, d("2026-02-01T00:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-01-31T12:00:00.000Z");
    expect(w.end?.toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("moves to the next window exactly at the boundary", () => {
    const w = monthlyWindow(anchor, d("2026-02-28T12:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(w.end?.toISOString()).toBe("2026-03-31T12:00:00.000Z");
  });

  it("gives annual subscribers monthly windows across the year", () => {
    const w = monthlyWindow(anchor, d("2026-08-15T00:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-07-31T12:00:00.000Z");
    expect(w.end?.toISOString()).toBe("2026-08-31T12:00:00.000Z");
  });

  it("treats a future anchor (clock skew) as the first window", () => {
    const w = monthlyWindow(anchor, d("2026-01-30T00:00:00Z"));
    expect(w.start.toISOString()).toBe(anchor.toISOString());
  });

  it("always contains `now`", () => {
    for (let day = 0; day < 800; day += 7) {
      const now = new Date(anchor.getTime() + day * 86_400_000);
      const w = monthlyWindow(anchor, now);
      expect(w.start.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(w.end!.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe("windowForPlan", () => {
  it("uses a single lifetime window for free", () => {
    const w = windowForPlan("free", null, d("2026-10-12T00:00:00Z"));
    expect(w.start).toEqual(LIFETIME_WINDOW_START);
    expect(w.end).toBeNull();
  });

  it("falls back to the UTC calendar month when the period is unknown", () => {
    const now = d("2026-10-12T09:00:00Z");
    expect(windowForPlan("plus", null, now).start).toEqual(startOfUtcMonth(now));
  });
});

describe("paidWindow", () => {
  const monthly = (start: string, end: string) => ({
    periodStart: d(start),
    periodEnd: d(end),
    billingInterval: "month",
  });
  const iso = (w: { start: Date; end: Date | null }) => [w.start.toISOString(), w.end?.toISOString()];

  it("uses Stripe's period for monthly billing", () => {
    const w = paidWindow(monthly("2026-09-20T08:00:00Z", "2026-10-20T08:00:00Z"), d("2026-10-12T00:00:00Z"));
    expect(iso(w)).toEqual(["2026-09-20T08:00:00.000Z", "2026-10-20T08:00:00.000Z"]);
  });

  it("keeps one window per billing period for month-end anchors (Feb 28 -> Mar 31)", () => {
    const period = monthly("2026-02-28T00:00:00Z", "2026-03-31T00:00:00Z");
    for (const now of ["2026-03-01T00:00:00Z", "2026-03-28T00:00:00Z", "2026-03-30T23:59:00Z"]) {
      expect(iso(paidWindow(period, d(now)))).toEqual(["2026-02-28T00:00:00.000Z", "2026-03-31T00:00:00.000Z"]);
    }
  });

  it("starts the next window at the period end while the renewal is unrecorded", () => {
    const w = paidWindow(monthly("2026-02-28T00:00:00Z", "2026-03-31T00:00:00Z"), d("2026-03-31T01:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-03-31T00:00:00.000Z");
  });

  it("gives annual billing monthly windows from the start of the billing year", () => {
    const period = { periodStart: d("2026-01-31T00:00:00Z"), periodEnd: d("2027-01-31T00:00:00Z"), billingInterval: "year" };
    expect(iso(paidWindow(period, d("2026-03-05T00:00:00Z")))).toEqual([
      "2026-02-28T00:00:00.000Z",
      "2026-03-31T00:00:00.000Z",
    ]);
    expect(iso(paidWindow(period, d("2027-01-15T00:00:00Z")))).toEqual([
      "2026-12-31T00:00:00.000Z",
      "2027-01-31T00:00:00.000Z",
    ]);
  });

  it("never extends an annual window past the billing year", () => {
    const period = { periodStart: d("2026-01-10T00:00:00Z"), periodEnd: d("2026-12-20T00:00:00Z"), billingInterval: "year" };
    expect(iso(paidWindow(period, d("2026-12-15T00:00:00Z")))).toEqual([
      "2026-12-10T00:00:00.000Z",
      "2026-12-20T00:00:00.000Z",
    ]);
  });

  it("always contains `now` within a monthly billing period", () => {
    const period = monthly("2026-01-31T00:00:00Z", "2026-02-28T00:00:00Z");
    for (let hour = 0; hour < 28 * 24; hour += 13) {
      const now = new Date(period.periodStart.getTime() + hour * 3_600_000);
      const w = paidWindow(period, now);
      expect(w.start.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(w.end!.getTime()).toBeGreaterThan(now.getTime());
    }
  });
});
