import { describe, expect, it } from "vitest";

import {
  addMonthsClamped,
  LIFETIME_WINDOW_START,
  monthlyWindow,
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

  it("anchors paid plans to the subscription start", () => {
    const w = windowForPlan("pro", d("2026-09-20T08:00:00Z"), d("2026-10-12T00:00:00Z"));
    expect(w.start.toISOString()).toBe("2026-09-20T08:00:00.000Z");
  });

  it("falls back to the UTC calendar month when the anchor is unknown", () => {
    const now = d("2026-10-12T09:00:00Z");
    expect(windowForPlan("plus", null, now).start).toEqual(startOfUtcMonth(now));
  });
});
