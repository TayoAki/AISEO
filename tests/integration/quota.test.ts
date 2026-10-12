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
      },
    };
    const october = await ensureBucket(db, quotaTarget(userId, "keyword", pro, new Date("2026-10-25T00:00:00Z")));
    const november = await ensureBucket(db, quotaTarget(userId, "keyword", pro, new Date("2026-11-25T00:00:00Z")));
    expect(october).not.toBe(november);
    expect((await bucketRow(october)).quota).toBe(100);
    expect((await bucketRow(october)).windowStart.toISOString()).toBe("2026-10-20T00:00:00.000Z");
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
