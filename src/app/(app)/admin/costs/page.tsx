import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CostCalculator, type CalculatorDefaults } from "@/components/admin/cost-calculator";
import { Alert, Badge, ButtonLink, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import {
  COST_ASSUMPTIONS,
  formatPercent,
  formatUnitCost,
  formatUsd,
  planEconomics,
  PLAN_KEYS,
  parsePlanKey,
  type FeatureCosts,
  type PlanKey,
} from "@/lib/cost-model";
import { cn } from "@/lib/utils";
import { costPeriod, getCostOverview, type CostOverview } from "@/server/admin/costs";
import { featureLabel, PLANS, type PaidPlanId } from "@/server/billing/plans";
import { getDb } from "@/server/db/client";
import { requireAdmin } from "@/server/web/session";

export const metadata: Metadata = { title: "Costs" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PERIODS = [7, 30, 90] as const;
const PLAN_LABELS: Record<PlanKey, string> = {
  pro_month: "Pro, monthly",
  pro_year: "Pro, annual",
  plus_month: "Plus, monthly",
  plus_year: "Plus, annual",
};
const EXAMPLE_CUSTOMERS: Record<PlanKey, number> = { pro_month: 70, pro_year: 0, plus_month: 30, plus_year: 0 };

const count = (value: number) => value.toLocaleString("en-US");
/** 0.029 -> "2.9%" without floating-point noise. */
const rate = (fraction: number) => `${Number((fraction * 100).toFixed(2))}%`;

function Stat({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {children ? <div className="text-xs text-muted-foreground">{children}</div> : null}
    </Card>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            {head.map((label, i) => (
              <th key={label} scope="col" className={cn("pb-2 font-medium", i > 0 && "text-right")}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}

function Row({ cells }: { cells: ReactNode[] }) {
  return (
    <tr className="border-t border-border">
      {cells.map((cell, i) => (
        <td key={i} className={cn("py-2", i > 0 && "text-right")}>
          {cell}
        </td>
      ))}
    </tr>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function MeasuredBadge({ measured }: { measured: boolean }) {
  return measured ? <Badge tone="success">measured</Badge> : <Badge tone="warning">estimate</Badge>;
}

/** Measured utilization per feature for a plan, falling back to the overall figure. */
function planUtilization(overview: CostOverview, plan: PaidPlanId): FeatureCosts {
  const fallback = overview.overallUtilization.value;
  return {
    keyword: overview.utilization[plan].keyword ?? fallback,
    visibility: overview.utilization[plan].visibility ?? fallback,
  };
}

function calculatorDefaults(overview: CostOverview): { defaults: CalculatorDefaults; exampleValues: boolean } {
  const { period, subscribers, free } = overview;
  const exampleValues = subscribers.payingCustomers === 0;
  const signupsPerMonth = Math.round((free.signups * 30) / period.days);
  const freeAllowance = PLANS.free.limits.keyword + PLANS.free.limits.visibility;
  return {
    exampleValues,
    defaults: {
      customers: exampleValues ? EXAMPLE_CUSTOMERS : subscribers.counts,
      utilization: overview.overallUtilization.value,
      freeSignupsPerMonth: exampleValues && signupsPerMonth === 0 ? 500 : signupsPerMonth,
      // Assume every signup uses the whole free allowance until there's data.
      freeUsageShare: free.signups > 0 ? Math.min(1, free.reports / (free.signups * freeAllowance)) : 1,
      costPerReport: {
        keyword: overview.costPerReport.paid.keyword.usd,
        visibility: overview.costPerReport.paid.visibility.usd,
      },
      fixedMonthlyUsd: COST_ASSUMPTIONS.fixedMonthlyUsd,
    },
  };
}

export default async function AdminCostsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const requested = Number(params.days);
  const days = PERIODS.find((d) => d === requested) ?? 30;
  const overview = await getCostOverview(getDb(), costPeriod(days));
  const { spend, costPerReport, subscribers } = overview;
  const { defaults, exampleValues } = calculatorDefaults(overview);
  const providerUsd = (provider: string) => spend.byProvider.find((p) => p.provider === provider)?.usd ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Costs and margins"
        description="What AISEO costs to run and what each plan earns. Only admins can see this page."
        actions={PERIODS.map((d) => (
          <ButtonLink key={d} href={`/admin/costs?days=${d}`} size="sm" variant={d === days ? "primary" : "secondary"}>
            {d} days
          </ButtonLink>
        ))}
      />

      {spend.unpricedCalls > 0 ? (
        <Alert tone="warning" title="Some calls have no price">
          {count(spend.unpricedCalls)} Claude calls used a model missing from <code>CLAUDE_PRICES</code> in{" "}
          <code>src/server/pipeline/costs.ts</code>, so they count as $0 here. Add the model&apos;s price.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={formatUsd(subscribers.mrrUsd)}>
          {count(subscribers.payingCustomers)} paying customers (annual plans counted per month)
        </Stat>
        <Stat label={`Provider spend, last ${days} days`} value={formatUsd(spend.totalUsd)}>
          Claude {formatUsd(providerUsd("anthropic"))} · Bright Data {formatUsd(providerUsd("brightdata"))}
        </Stat>
        <Stat label="Cost per paid keyword report" value={formatUnitCost(costPerReport.paid.keyword.usd)}>
          <span className="flex flex-col items-start gap-1">
            <MeasuredBadge measured={costPerReport.paid.keyword.measured} />
            <span className="flex items-center gap-1">
              Visibility scan {formatUnitCost(costPerReport.paid.visibility.usd)}
              <MeasuredBadge measured={costPerReport.paid.visibility.measured} />
            </span>
          </span>
        </Stat>
        <Stat label={`Gross margin, last ${days} days`} value={formatPercent(overview.periodMargin)}>
          {overview.periodMargin === null
            ? "No revenue yet."
            : `Revenue ${formatUsd(overview.periodRevenueUsd)} minus reports, Stripe fees and hosting.`}
        </Stat>
      </div>

      <Section
        title="Plan economics"
        description={`One subscriber per month. Usage is ${
          overview.overallUtilization.measured ? `measured over the last ${days} days` : "an estimate until you have subscribers"
        }; report costs are ${costPerReport.paid.keyword.measured ? "measured" : "estimates"}. Fixed costs are excluded.`}
      >
        <Table head={["Plan", "Price / month", "Stripe fees", "Allowance used", "Report costs", "Margin", "At full use", "Margin at full use"]}>
          {PLAN_KEYS.map((key) => {
            const { plan, interval } = parsePlanKey(key);
            const utilization = planUtilization(overview, plan);
            const economics = planEconomics(plan, interval, defaults.costPerReport, utilization);
            const limits = PLANS[plan].limits;
            const usedShare =
              (limits.keyword * utilization.keyword + limits.visibility * utilization.visibility) /
              (limits.keyword + limits.visibility);
            return (
              <Row
                key={key}
                cells={[
                  <span key="plan">
                    {PLAN_LABELS[key]}{" "}
                    <span className="text-xs text-muted-foreground">({count(subscribers.counts[key])})</span>
                  </span>,
                  formatUsd(economics.revenue),
                  formatUsd(economics.stripeFees),
                  formatPercent(usedShare),
                  formatUsd(economics.usageCost),
                  formatPercent(economics.margin),
                  formatUsd(economics.fullUsageCost),
                  <span key="full" className={economics.fullUsageMargin < 0 ? "text-destructive" : undefined}>
                    {formatPercent(economics.fullUsageMargin)}
                  </span>,
                ]}
              />
            );
          })}
        </Table>
      </Section>

      <CostCalculator defaults={defaults} exampleValues={exampleValues} />

      <Section
        title="Cost per report"
        description={`Reports created in the last ${days} days. Failed reports are refunded to the user but still cost money; they are included in the totals.`}
      >
        {overview.reportGroups.length === 0 ? (
          <EmptyState title="No reports yet">Costs appear here as soon as reports run.</EmptyState>
        ) : (
          <Table head={["Report", "Reports", "Completed", "Failed", "Avg. completed", "90th percentile", "Total cost"]}>
            {overview.reportGroups.map((group) => (
              <Row
                key={`${group.type}-${group.tier}`}
                cells={[
                  `${featureLabel(group.type)} · ${PLANS[group.tier].name}`,
                  count(group.reports),
                  count(group.completed),
                  count(group.failed),
                  group.avgCompletedUsd === null ? "–" : formatUnitCost(group.avgCompletedUsd),
                  group.p90CompletedUsd === null ? "–" : formatUnitCost(group.p90CompletedUsd),
                  formatUsd(group.totalUsd),
                ]}
              />
            ))}
          </Table>
        )}
        {overview.failedReportsUsd > 0 ? (
          <p className="text-sm text-muted-foreground">Failed reports cost {formatUsd(overview.failedReportsUsd)} in this period.</p>
        ) : null}
      </Section>

      <Section title="Where the money goes" description={`Every billed call in the last ${days} days, by provider and step.`}>
        {overview.tasks.length === 0 ? (
          <EmptyState title="No billed calls yet" />
        ) : (
          <Table head={["Provider and step", "Calls", "Input tokens", "Output tokens", "Records", "Cost"]}>
            {overview.tasks.map((task) => (
              <Row
                key={`${task.provider}-${task.task}-${task.model ?? ""}`}
                cells={[
                  <span key="task">
                    {task.provider === "anthropic" ? "Claude" : "Bright Data"} · {task.task}
                    {task.model ? <span className="text-xs text-muted-foreground"> ({task.model})</span> : null}
                  </span>,
                  count(task.calls),
                  task.provider === "anthropic" ? count(task.inputTokens) : "–",
                  task.provider === "anthropic" ? count(task.outputTokens) : "–",
                  task.provider === "brightdata" ? count(task.records) : "–",
                  formatUsd(task.usd),
                ]}
              />
            ))}
          </Table>
        )}
      </Section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Free plan" description={`The cost of free signups in the last ${days} days.`}>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">New signups</dt>
            <dd className="text-right tabular-nums">{count(overview.free.signups)}</dd>
            <dt className="text-muted-foreground">Free users who ran reports</dt>
            <dd className="text-right tabular-nums">{count(overview.free.usersWithReports)}</dd>
            <dt className="text-muted-foreground">Free reports</dt>
            <dd className="text-right tabular-nums">{count(overview.free.reports)}</dd>
            <dt className="text-muted-foreground">Cost of free reports</dt>
            <dd className="text-right tabular-nums">{formatUsd(overview.free.usd)}</dd>
            <dt className="text-muted-foreground">Cost per new signup</dt>
            <dd className="text-right tabular-nums">
              {overview.free.signups > 0 ? formatUnitCost(overview.free.usd / overview.free.signups) : "–"}
            </dd>
          </dl>
        </Section>

        <Section title="Top users by cost" description={`The ten accounts that cost the most in the last ${days} days.`}>
          {overview.topUsers.length === 0 ? (
            <EmptyState title="No usage yet" />
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {overview.topUsers.map((u) => (
                <li key={u.userId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{u.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.tiers.map((tier) => PLANS[tier as keyof typeof PLANS]?.name ?? tier).join(", ")} ·{" "}
                      {count(u.reports)} reports
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{formatUsd(u.usd)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <p className="text-xs text-muted-foreground">
        Assumptions: Stripe {rate(COST_ASSUMPTIONS.stripe.percent)} + ${COST_ASSUMPTIONS.stripe.fixedUsd.toFixed(2)} per
        charge plus {rate(COST_ASSUMPTIONS.stripe.billingPercent)} for Stripe Billing; {formatUsd(COST_ASSUMPTIONS.fixedMonthlyUsd)} a
        month of fixed costs; until measured, {formatUnitCost(COST_ASSUMPTIONS.estimatedReportCostUsd.keyword)} per keyword
        report, {formatUnitCost(COST_ASSUMPTIONS.estimatedReportCostUsd.visibility)} per visibility scan and{" "}
        {formatPercent(COST_ASSUMPTIONS.estimatedUtilization)} of allowances used. Change them in{" "}
        <code>src/lib/cost-model.ts</code>. Report costs come from <code>report_usage</code> at list prices.
      </p>
    </div>
  );
}
