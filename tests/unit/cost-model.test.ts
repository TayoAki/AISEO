import { afterEach, describe, expect, it } from "vitest";

import {
  formatPercent,
  formatUnitCost,
  formatUsd,
  freeSignupCost,
  monthlyRevenue,
  planEconomics,
  runScenario,
  stripeFeesPerMonth,
  usageCostPerMonth,
} from "@/lib/cost-model";
import { isAdmin } from "@/server/admin/admins";
import { getEnv, resetEnvCache } from "@/server/env";

const costs = { keyword: 0.06, visibility: 0.09 };

describe("cost model", () => {
  it("spreads annual plans and their single Stripe charge over 12 months", () => {
    expect(monthlyRevenue("pro", "month")).toBe(29);
    expect(monthlyRevenue("pro", "year")).toBeCloseTo(290 / 12);
    // 2.9% + 0.7% + $0.30 per charge.
    expect(stripeFeesPerMonth("pro", "month")).toBeCloseTo(29 * 0.036 + 0.3);
    expect(stripeFeesPerMonth("plus", "year")).toBeCloseTo((790 * 0.036 + 0.3) / 12);
  });

  it("prices usage from plan allowances, per feature when utilization differs", () => {
    expect(usageCostPerMonth("pro", costs, 1)).toBeCloseTo(100 * 0.06 + 25 * 0.09);
    expect(usageCostPerMonth("plus", costs, 0.3)).toBeCloseTo((500 * 0.06 + 100 * 0.09) * 0.3);
    expect(usageCostPerMonth("pro", costs, { keyword: 0.5, visibility: 0 })).toBeCloseTo(50 * 0.06);
    expect(freeSignupCost(costs, 1)).toBeCloseTo(2 * 0.06 + 2 * 0.09);
  });

  it("computes plan margins at a utilization and at full use", () => {
    const pro = planEconomics("pro", "month", costs, 0.3);
    expect(pro.fullUsageMargin).toBeCloseTo((29 - 1.344 - 8.25) / 29);
    expect(pro.margin).toBeCloseTo((29 - 1.344 - 8.25 * 0.3) / 29);
    const plusAnnual = planEconomics("plus", "year", costs, 1);
    expect(plusAnnual.fullUsageMargin).toBeCloseTo((790 / 12 - (790 * 0.036 + 0.3) / 12 - 39) / (790 / 12));
  });

  it("runs a month of the business", () => {
    const result = runScenario({
      customers: { pro_month: 70, pro_year: 0, plus_month: 30, plus_year: 0 },
      utilization: 0.3,
      freeSignupsPerMonth: 500,
      freeUsageShare: 1,
      paidCostPerReport: costs,
      freeCostPerReport: costs,
      fixedMonthlyUsd: 40,
    });
    expect(result.payingCustomers).toBe(100);
    expect(result.revenue).toBeCloseTo(4400);
    expect(result.paidUsageCost).toBeCloseTo(70 * 2.475 + 30 * 11.7);
    expect(result.stripeFees).toBeCloseTo(70 * 1.344 + 30 * 3.144);
    expect(result.freeCost).toBeCloseTo(150);
    expect(result.totalCost).toBeCloseTo(524.25 + 188.4 + 150 + 40);
    expect(result.margin).toBeCloseTo((4400 - 902.65) / 4400);
  });

  it("has no margin without revenue and ignores negative inputs", () => {
    const result = runScenario({
      customers: { pro_month: -5, pro_year: 0, plus_month: 0, plus_year: 0 },
      utilization: 0.3,
      freeSignupsPerMonth: 100,
      freeUsageShare: 1,
      paidCostPerReport: costs,
      freeCostPerReport: costs,
      fixedMonthlyUsd: 5,
    });
    expect(result.revenue).toBe(0);
    expect(result.margin).toBeNull();
    expect(result.totalCost).toBeCloseTo(30 + 5);
  });

  it("formats money and percentages", () => {
    expect(formatUnitCost(0.0612)).toBe("$0.0612");
    expect(formatUnitCost(0.061)).toBe("$0.0610");
    expect(formatUsd(0.895)).toBe("$0.90");
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatUsd(4400)).toBe("$4,400");
    expect(formatPercent(0.795)).toBe("80%");
    expect(formatPercent(null)).toBe("–");
  });
});

describe("admins", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
    resetEnvCache();
  });

  it("admits only verified accounts listed in ADMIN_EMAILS, ignoring case", () => {
    const admins = ["owner@aiseo.app"];
    expect(isAdmin({ email: "Owner@AISEO.app", emailVerified: true }, admins)).toBe(true);
    expect(isAdmin({ email: "owner@aiseo.app", emailVerified: false }, admins)).toBe(false);
    expect(isAdmin({ email: "someone@aiseo.app", emailVerified: true }, admins)).toBe(false);
    expect(isAdmin({ email: "owner@aiseo.app", emailVerified: true }, [])).toBe(false);
  });

  it("parses ADMIN_EMAILS from the environment and rejects malformed entries", () => {
    process.env.ADMIN_EMAILS = " Owner@AISEO.app, ops@aiseo.app ,";
    resetEnvCache();
    expect(getEnv().ADMIN_EMAILS).toEqual(["owner@aiseo.app", "ops@aiseo.app"]);

    process.env.ADMIN_EMAILS = "owner@aiseo.app, not-an-email";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/ADMIN_EMAILS/);
  });

  it("has no admins by default", () => {
    resetEnvCache();
    expect(getEnv().ADMIN_EMAILS).toEqual([]);
    expect(isAdmin({ email: "owner@aiseo.app", emailVerified: true })).toBe(false);
  });
});
