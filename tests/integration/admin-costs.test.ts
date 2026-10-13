import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { stripeFeesPerMonth } from "@/lib/cost-model";
import { costPeriod, getCostOverview, type CostOverview } from "@/server/admin/costs";
import { report, reportUsage, subscription, usageBucket } from "@/server/db/schema";

import { createTestUser, openTestDatabase, resetTestDatabase } from "../helpers/db";

const handles = openTestDatabase(5);
const db = handles.db;
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
let overview: CostOverview;
let bucketSeq = 0;

type Tier = "free" | "pro" | "plus";
type Feature = "keyword" | "visibility";

async function subscribe(userId: string, plan: string, interval: "month" | "year", status = "active", periodEnd = new Date(now.getTime() + 20 * DAY)) {
  await db.insert(subscription).values({
    id: randomUUID(),
    plan,
    referenceId: userId,
    status,
    periodStart: new Date(periodEnd.getTime() - 30 * DAY),
    periodEnd,
    billingInterval: interval,
  });
}

/** A report with its recorded provider costs (micro-dollars; null means unpriced). */
async function reportWithCosts(
  userId: string,
  type: Feature,
  tier: Tier,
  status: "completed" | "failed",
  costs: Array<{ provider: "anthropic" | "brightdata"; micros: number | null }>,
  createdAt = now,
) {
  const [bucket] = await db
    .insert(usageBucket)
    .values({ userId, feature: type, plan: tier, windowStart: new Date(createdAt.getTime() - ++bucketSeq * 1000), quota: 100 })
    .returning();
  const [row] = await db
    .insert(report)
    .values({
      userId,
      type,
      tier,
      status,
      title: `${type} report`,
      input: type === "keyword" ? { type, keyword: "crm", country: "US" } : { type, website: "https://acme.example", brand: "Acme", topic: "crm" },
      usageBucketId: bucket!.id,
      idempotencyKey: randomUUID(),
      createdAt,
    })
    .returning();
  await db.insert(reportUsage).values(
    costs.map(({ provider, micros }) => ({
      reportId: row!.id,
      provider,
      task: provider === "anthropic" ? `${type}-analysis` : `collect:${type === "keyword" ? "perplexity" : "chatgpt"}`,
      model: provider === "anthropic" ? "claude-sonnet-5-5" : null,
      inputTokens: provider === "anthropic" ? 6000 : 0,
      outputTokens: provider === "anthropic" ? 3000 : 0,
      records: provider === "brightdata" ? 3 : 0,
      costMicros: micros,
      createdAt,
    })),
  );
}

beforeAll(async () => {
  await resetTestDatabase();
  const proUser = await createTestUser(db);
  const plusAnnualUser = await createTestUser(db);
  const freeUser = await createTestUser(db);
  const canceledUser = await createTestUser(db);
  const upgradedUser = await createTestUser(db);

  await subscribe(proUser.id, "pro", "month");
  await subscribe(plusAnnualUser.id, "plus", "year");
  await subscribe(canceledUser.id, "pro", "month", "canceled");
  // A row whose period ended long ago no longer counts, whatever its status says.
  await subscribe(canceledUser.id, "plus", "month", "active", new Date(now.getTime() - 10 * DAY));
  // Two live rows for one user count once, at the better plan.
  await subscribe(upgradedUser.id, "pro", "month");
  await subscribe(upgradedUser.id, "plus", "month");

  await reportWithCosts(proUser.id, "keyword", "pro", "completed", [
    { provider: "anthropic", micros: 50_000 },
    { provider: "brightdata", micros: 4_500 },
  ]);
  await reportWithCosts(proUser.id, "keyword", "pro", "failed", [{ provider: "brightdata", micros: 4_500 }]);
  await reportWithCosts(plusAnnualUser.id, "visibility", "plus", "completed", [
    { provider: "anthropic", micros: 70_000 },
    { provider: "brightdata", micros: 15_000 },
  ]);
  await reportWithCosts(freeUser.id, "keyword", "free", "completed", [
    { provider: "anthropic", micros: 40_000 },
    { provider: "brightdata", micros: 4_500 },
    { provider: "anthropic", micros: null },
  ]);
  // Outside the 30-day window.
  await reportWithCosts(freeUser.id, "keyword", "free", "completed", [{ provider: "anthropic", micros: 999_000 }], new Date(now.getTime() - 60 * DAY));

  // The window ends just after seeding, so rows stamped by the database clock fall inside it.
  overview = await getCostOverview(db, costPeriod(30, new Date(Date.now() + 1000)));
});

afterAll(async () => {
  await handles.pool.end();
});

describe("admin cost overview", () => {
  it("totals provider spend in the period and flags unpriced calls", () => {
    expect(overview.spend.totalUsd).toBeCloseTo(0.1885);
    expect(overview.spend.unpricedCalls).toBe(1);
    const anthropic = overview.spend.byProvider.find((p) => p.provider === "anthropic");
    expect(anthropic).toMatchObject({ calls: 4, unpricedCalls: 1 });
    expect(anthropic?.usd).toBeCloseTo(0.16);
    expect(overview.spend.byProvider.find((p) => p.provider === "brightdata")?.usd).toBeCloseTo(0.0285);
  });

  it("groups report costs by type and plan, failed reports included", () => {
    const keywordPro = overview.reportGroups.find((g) => g.type === "keyword" && g.tier === "pro");
    expect(keywordPro).toMatchObject({ reports: 2, completed: 1, failed: 1 });
    expect(keywordPro?.avgCompletedUsd).toBeCloseTo(0.0545);
    expect(keywordPro?.totalUsd).toBeCloseTo(0.059);
    expect(overview.failedReportsUsd).toBeCloseTo(0.0045);
    expect(overview.reportGroups.find((g) => g.tier === "free")).toMatchObject({ reports: 1, completed: 1 });
  });

  it("spreads failed reports' cost over delivered ones and estimates what isn't measured", () => {
    expect(overview.costPerReport.paid.keyword).toMatchObject({ completed: 1, measured: true });
    expect(overview.costPerReport.paid.keyword.usd).toBeCloseTo(0.059);
    expect(overview.costPerReport.paid.visibility.usd).toBeCloseTo(0.085);
    expect(overview.costPerReport.free.keyword.usd).toBeCloseTo(0.0445);
    expect(overview.costPerReport.free.visibility).toEqual({ usd: 0.09, completed: 0, measured: false });
  });

  it("counts each paying user once, at their best live plan", () => {
    expect(overview.subscribers.counts).toEqual({ pro_month: 1, pro_year: 0, plus_month: 1, plus_year: 1 });
    expect(overview.subscribers.payingCustomers).toBe(3);
    expect(overview.subscribers.mrrUsd).toBeCloseTo(29 + 79 + 790 / 12);
  });

  it("measures allowance use per plan", () => {
    expect(overview.utilization.pro.keyword).toBeCloseTo(1 / 100);
    expect(overview.utilization.pro.visibility).toBe(0);
    expect(overview.utilization.plus.visibility).toBeCloseTo(1 / 200);
    expect(overview.overallUtilization.measured).toBe(true);
  });

  it("reports free-plan cost, top users and the period margin", () => {
    expect(overview.free).toMatchObject({ signups: 5, usersWithReports: 1, reports: 1 });
    expect(overview.free.usd).toBeCloseTo(0.0445);
    expect(overview.topUsers.map((u) => u.usd)).toEqual(
      [...overview.topUsers.map((u) => u.usd)].sort((a, b) => b - a),
    );
    expect(overview.topUsers[0]?.usd).toBeCloseTo(0.085);
    expect(overview.topUsers[0]?.tiers).toEqual(["plus"]);

    const revenue = 29 + 79 + 790 / 12;
    const stripe = stripeFeesPerMonth("pro", "month") + stripeFeesPerMonth("plus", "month") + stripeFeesPerMonth("plus", "year");
    expect(overview.periodRevenueUsd).toBeCloseTo(revenue);
    expect(overview.periodMargin).toBeCloseTo((revenue - 0.1885 - stripe - 5) / revenue);
  });
});
