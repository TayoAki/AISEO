import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { freeEntitlements, type Entitlements } from "@/server/billing/entitlements";
import { usageBucket } from "@/server/db/schema";
import {
  ensureBucket,
  getUsageSummary,
  quotaTarget,
  reserveUnit,
  settleReservation,
} from "@/server/quota/quota";

import { createReservedReport, createTestUser, openTestDatabase, resetTestDatabase } from "../helpers/db";

const handles = openTestDatabase(30);
const db = handles.db;
const now = new Date("2026-10-12T12:00:00Z");

async function bucketRow(id: string) {
  const [row] = await db.select().from(usageBucket).where(eq(usageBucket.id, id));
  return row!;
}

beforeAll(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await handles.pool.end();
});

let userId: string;

beforeEach(async () => {
  userId = (await createTestUser(db)).id;
});

describe("reserveUnit", () => {
  it("allows exactly `quota` sequential reservations", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "keyword", freeEntitlements(), now));
    expect(await reserveUnit(db, bucketId)).toBe(true);
    expect(await reserveUnit(db, bucketId)).toBe(true);
    expect(await reserveUnit(db, bucketId)).toBe(false);
    expect((await bucketRow(bucketId)).reserved).toBe(2);
  });

  it("never oversells under heavy concurrency", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "visibility", freeEntitlements(), now));
    const attempts = await Promise.all(
      Array.from({ length: 25 }, () => db.transaction((tx) => reserveUnit(tx, bucketId))),
    );
    expect(attempts.filter(Boolean)).toHaveLength(2);
    const row = await bucketRow(bucketId);
    expect(row.reserved).toBe(2);
    expect(row.used).toBe(0);
  });

  it("is backed by a CHECK constraint even if a raw update tries to oversell", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "keyword", freeEntitlements(), now));
    await expect(
      db.execute(sql`update usage_bucket set reserved = quota + 1 where id = ${bucketId}`),
    ).rejects.toThrow();
  });
});

describe("ensureBucket", () => {
  it("creates one bucket per window even when called concurrently", async () => {
    const target = quotaTarget(userId, "keyword", freeEntitlements(), now);
    const ids = await Promise.all(Array.from({ length: 10 }, () => ensureBucket(db, target)));
    expect(new Set(ids).size).toBe(1);
  });

  it("opens a fresh paid allowance each subscription month", async () => {
    const pro: Entitlements = {
      plan: "pro",
      isPaid: true,
      insights: true,
      subscription: {
        plan: "pro",
        status: "active",
        periodStart: new Date("2026-01-20T00:00:00Z"),
        periodEnd: new Date("2027-01-20T00:00:00Z"),
        billingInterval: "year",
        cancelAtPeriodEnd: false,
        endsAt: null,
      },
    };
    const october = await ensureBucket(db, quotaTarget(userId, "keyword", pro, new Date("2026-10-25T00:00:00Z")));
    const november = await ensureBucket(db, quotaTarget(userId, "keyword", pro, new Date("2026-11-25T00:00:00Z")));
    expect(october).not.toBe(november);
    expect((await bucketRow(october)).quota).toBe(100);
    expect((await bucketRow(october)).windowStart.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
});

function proMonthly(periodStart: string, periodEnd: string, billingInterval = "month"): Entitlements {
  return {
    plan: "pro",
    isPaid: true,
    insights: true,
    subscription: {
      plan: "pro",
      status: "active",
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      billingInterval,
      cancelAtPeriodEnd: false,
      endsAt: null,
    },
  };
}

describe("paid billing periods", () => {
  it("keeps one allowance per period for month-end anchors (Feb 28 -> Mar 31)", async () => {
    const period = proMonthly("2026-02-28T00:00:00Z", "2026-03-31T00:00:00Z");
    const early = await ensureBucket(db, quotaTarget(userId, "visibility", period, new Date("2026-03-01T00:00:00Z")));
    const late = await ensureBucket(db, quotaTarget(userId, "visibility", period, new Date("2026-03-29T00:00:00Z")));
    expect(late).toBe(early);
  });

  it("does not restart the allowance when switching monthly <-> annual mid-window", async () => {
    const monthly = proMonthly("2026-03-05T00:00:00Z", "2026-04-05T00:00:00Z");
    const first = await ensureBucket(db, quotaTarget(userId, "visibility", monthly, new Date("2026-03-06T00:00:00Z")));
    for (let i = 0; i < 25; i++) expect(await reserveUnit(db, first)).toBe(true);

    // Stripe resets the anchor to the switch time when the interval changes.
    const annual = proMonthly("2026-03-10T00:00:00Z", "2027-03-10T00:00:00Z", "year");
    const switchedNow = new Date("2026-03-10T00:05:00Z");
    const second = await ensureBucket(db, quotaTarget(userId, "visibility", annual, switchedNow));
    expect(second).toBe(first);
    expect(await reserveUnit(db, second)).toBe(false);
    expect((await bucketRow(second)).windowEnd?.toISOString()).toBe("2026-04-10T00:00:00.000Z");

    const backToMonthly = proMonthly("2026-03-12T00:00:00Z", "2026-04-12T00:00:00Z");
    const third = await ensureBucket(db, quotaTarget(userId, "visibility", backToMonthly, new Date("2026-03-12T00:05:00Z")));
    expect(third).toBe(first);

    const summary = await getUsageSummary(db, userId, backToMonthly, new Date("2026-03-12T00:05:00Z"));
    expect(summary.visibility.remaining).toBe(0);
    expect(summary.visibility.resetsAt?.toISOString()).toBe("2026-04-12T00:00:00.000Z");

    // The next billing period opens a fresh allowance.
    const nextPeriod = proMonthly("2026-04-12T00:00:00Z", "2026-05-12T00:00:00Z");
    const fresh = await ensureBucket(db, quotaTarget(userId, "visibility", nextPeriod, new Date("2026-04-12T01:00:00Z")));
    expect(fresh).not.toBe(first);
  });

  it("keeps the same bucket when a renewal is recorded late", async () => {
    const stale = proMonthly("2026-02-28T00:00:00Z", "2026-03-31T00:00:00Z");
    const beforeWebhook = await ensureBucket(db, quotaTarget(userId, "keyword", stale, new Date("2026-03-31T00:30:00Z")));
    const renewed = proMonthly("2026-03-31T00:00:00Z", "2026-04-30T00:00:00Z");
    const afterWebhook = await ensureBucket(db, quotaTarget(userId, "keyword", renewed, new Date("2026-03-31T01:00:00Z")));
    expect(afterWebhook).toBe(beforeWebhook);
  });
});

describe("settleReservation", () => {
  it("commits once: reserved moves to used", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "keyword", freeEntitlements(), now));
    await reserveUnit(db, bucketId);
    const report = await createReservedReport(db, userId, bucketId);

    expect(await settleReservation(db, report.id, "commit")).toBe(true);
    expect(await settleReservation(db, report.id, "commit")).toBe(false);
    expect(await settleReservation(db, report.id, "release")).toBe(false);

    const row = await bucketRow(bucketId);
    expect(row.used).toBe(1);
    expect(row.reserved).toBe(0);
  });

  it("releases once, so a failed report gives the unit back", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "keyword", freeEntitlements(), now));
    await reserveUnit(db, bucketId);
    await reserveUnit(db, bucketId);
    const report = await createReservedReport(db, userId, bucketId);

    expect(await reserveUnit(db, bucketId)).toBe(false);
    expect(await settleReservation(db, report.id, "release")).toBe(true);
    expect(await settleReservation(db, report.id, "release")).toBe(false);
    expect(await reserveUnit(db, bucketId)).toBe(true);

    const row = await bucketRow(bucketId);
    expect(row.used).toBe(0);
    expect(row.reserved).toBe(2);
  });

  it("settles exactly once when commit and release race", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "visibility", freeEntitlements(), now));
    await reserveUnit(db, bucketId);
    const report = await createReservedReport(db, userId, bucketId);

    const results = await Promise.all([
      db.transaction((tx) => settleReservation(tx, report.id, "commit")),
      db.transaction((tx) => settleReservation(tx, report.id, "release")),
      db.transaction((tx) => settleReservation(tx, report.id, "commit")),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const row = await bucketRow(bucketId);
    expect(row.reserved).toBe(0);
    expect(row.used + row.reserved).toBeLessThanOrEqual(1);
  });
});

describe("getUsageSummary", () => {
  it("reports remaining allowance including in-flight reservations", async () => {
    const bucketId = await ensureBucket(db, quotaTarget(userId, "keyword", freeEntitlements(), now));
    await reserveUnit(db, bucketId);
    const summary = await getUsageSummary(db, userId, freeEntitlements(), now);
    expect(summary.keyword).toMatchObject({ quota: 2, reserved: 1, used: 0, remaining: 1, resetsAt: null });
    expect(summary.visibility).toMatchObject({ quota: 2, remaining: 2 });
  });
});
