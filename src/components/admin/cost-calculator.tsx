"use client";

import { useMemo, useState } from "react";

import { Button, Card, CardTitle, Field, Input } from "@/components/ui";
import {
  formatPercent,
  formatUsd,
  PLAN_KEYS,
  runScenario,
  type FeatureCosts,
  type PlanKey,
} from "@/lib/cost-model";

export type CalculatorDefaults = {
  customers: Record<PlanKey, number>;
  /** 0 to 1. */
  utilization: number;
  freeSignupsPerMonth: number;
  /** 0 to 1. */
  freeUsageShare: number;
  costPerReport: FeatureCosts;
  fixedMonthlyUsd: number;
};

const CUSTOMER_LABELS: Record<PlanKey, string> = {
  pro_month: "Pro, monthly",
  pro_year: "Pro, annual",
  plus_month: "Plus, monthly",
  plus_year: "Plus, annual",
};

type Values = Record<PlanKey | "utilization" | "freeSignups" | "freeShare" | "keywordCost" | "visibilityCost" | "fixed", string>;

function toValues(d: CalculatorDefaults): Values {
  return {
    pro_month: String(d.customers.pro_month),
    pro_year: String(d.customers.pro_year),
    plus_month: String(d.customers.plus_month),
    plus_year: String(d.customers.plus_year),
    utilization: String(Math.round(d.utilization * 100)),
    freeSignups: String(d.freeSignupsPerMonth),
    freeShare: String(Math.round(d.freeUsageShare * 100)),
    keywordCost: d.costPerReport.keyword.toFixed(4),
    visibilityCost: d.costPerReport.visibility.toFixed(4),
    fixed: String(d.fixedMonthlyUsd),
  };
}

/** Non-negative number from a form field; blanks and junk count as 0. */
function num(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const percent = (value: string) => Math.min(100, num(value)) / 100;

export function CostCalculator({ defaults, exampleValues }: { defaults: CalculatorDefaults; exampleValues: boolean }) {
  const [values, setValues] = useState<Values>(() => toValues(defaults));
  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const result = useMemo(() => {
    const costPerReport = { keyword: num(values.keywordCost), visibility: num(values.visibilityCost) };
    return runScenario({
      customers: Object.fromEntries(PLAN_KEYS.map((key) => [key, Math.floor(num(values[key]))])) as Record<PlanKey, number>,
      utilization: percent(values.utilization),
      freeSignupsPerMonth: Math.floor(num(values.freeSignups)),
      freeUsageShare: percent(values.freeShare),
      // Free reports skip the paid insight sections, so this slightly overstates their cost.
      paidCostPerReport: costPerReport,
      freeCostPerReport: costPerReport,
      fixedMonthlyUsd: num(values.fixed),
    });
  }, [values]);

  const lines: Array<[string, number]> = [
    ["Report costs (paying customers)", result.paidUsageCost],
    ["Stripe fees", result.stripeFees],
    ["Free signups", result.freeCost],
    ["Hosting and fixed costs", result.fixedCost],
  ];

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>What-if calculator</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            One month of the business with your own numbers.{" "}
            {exampleValues
              ? "No paying customers yet, so it starts from example values (70 Pro and 30 Plus customers)."
              : "It starts from your live numbers."}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setValues(toValues(defaults))}>
          Reset
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {PLAN_KEYS.map((key) => (
            <Field key={key} id={`calc-${key}`} label={`${CUSTOMER_LABELS[key]} customers`}>
              <Input id={`calc-${key}`} type="number" inputMode="numeric" min={0} step={1} value={values[key]} onChange={set(key)} />
            </Field>
          ))}
          <Field id="calc-utilization" label="Allowance used (%)" hint="Share of their monthly reports subscribers run">
            <Input id="calc-utilization" type="number" min={0} max={100} step={1} value={values.utilization} onChange={set("utilization")} />
          </Field>
          <Field id="calc-fixed" label="Hosting and fixed costs ($/month)" hint="Railway, email and other flat costs">
            <Input id="calc-fixed" type="number" min={0} step={1} value={values.fixed} onChange={set("fixed")} />
          </Field>
          <Field id="calc-free" label="New free signups per month">
            <Input id="calc-free" type="number" inputMode="numeric" min={0} step={1} value={values.freeSignups} onChange={set("freeSignups")} />
          </Field>
          <Field id="calc-free-share" label="Free reports used (%)" hint="Share of the 2 + 2 free reports a signup runs">
            <Input id="calc-free-share" type="number" min={0} max={100} step={1} value={values.freeShare} onChange={set("freeShare")} />
          </Field>
          <Field id="calc-keyword" label="Cost per keyword report ($)">
            <Input id="calc-keyword" type="number" min={0} step={0.001} value={values.keywordCost} onChange={set("keywordCost")} />
          </Field>
          <Field id="calc-visibility" label="Cost per visibility scan ($)">
            <Input id="calc-visibility" type="number" min={0} step={0.001} value={values.visibilityCost} onChange={set("visibilityCost")} />
          </Field>
        </div>

        <div aria-live="polite" className="flex flex-col gap-3 rounded-lg bg-muted/60 p-4">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Paying customers</dt>
            <dd className="text-right tabular-nums">{result.payingCustomers.toLocaleString("en-US")}</dd>
            <dt className="font-medium">Revenue</dt>
            <dd className="text-right font-medium tabular-nums">{formatUsd(result.revenue)}</dd>
            {lines.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">−{formatUsd(value)}</dd>
              </div>
            ))}
            <dt className="border-t border-border pt-2 font-medium">Total costs</dt>
            <dd className="border-t border-border pt-2 text-right font-medium tabular-nums">{formatUsd(result.totalCost)}</dd>
            <dt className="font-medium">Gross profit</dt>
            <dd className={`text-right font-medium tabular-nums ${result.grossProfit < 0 ? "text-destructive" : ""}`}>
              {formatUsd(result.grossProfit)}
            </dd>
          </dl>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Gross margin</p>
            <p className={`text-3xl font-semibold tabular-nums ${result.margin !== null && result.margin < 0 ? "text-destructive" : ""}`}>
              {formatPercent(result.margin)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
