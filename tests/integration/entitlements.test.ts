import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getEntitlements } from "@/server/billing/entitlements";
import { subscription } from "@/server/db/schema";

import { createTestUser, openTestDatabase, resetTestDatabase } from "../helpers/db";

const handles = openTestDatabase(5);
const db = handles.db;
const now = new Date("2026-10-12T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

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

async function addSubscription(values: Partial<typeof subscription.$inferInsert>) {
  await db.insert(subscription).values({
    id: randomUUID(),
    plan: "pro",
    referenceId: userId,
    status: "active",
    periodStart: days(-20),
    periodEnd: days(10),
    billingInterval: "month",
    ...values,
  });
}

describe("getEntitlements", () => {
  it("grants the paid plan for an active subscription", async () => {
    await addSubscription({});
    const entitlements = await getEntitlements(db, userId, now);
    expect(entitlements.plan).toBe("pro");
    expect(entitlements.insights).toBe(true);
  });

  it("keeps access while past_due and within the grace period after the period end", async () => {
    await addSubscription({ status: "past_due", periodStart: days(-31), periodEnd: days(-1) });
    expect((await getEntitlements(db, userId, now)).plan).toBe("pro");
  });

  it("ignores an 'active' row whose period ended long ago (a lost cancellation webhook)", async () => {
    await addSubscription({ status: "active", periodStart: days(-60), periodEnd: days(-30) });
    const entitlements = await getEntitlements(db, userId, now);
    expect(entitlements.plan).toBe("free");
    expect(entitlements.isPaid).toBe(false);
  });

  it("picks the highest plan and reports a scheduled cancellation", async () => {
    await addSubscription({ plan: "pro" });
    await addSubscription({ plan: "plus", cancelAt: days(5) });
    const entitlements = await getEntitlements(db, userId, now);
    expect(entitlements.plan).toBe("plus");
    expect(entitlements.subscription?.endsAt?.toISOString()).toBe(days(5).toISOString());
  });

  it("treats canceled subscriptions as free", async () => {
    await addSubscription({ status: "canceled" });
    expect((await getEntitlements(db, userId, now)).plan).toBe("free");
  });
});
