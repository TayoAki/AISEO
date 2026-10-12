"use client";

import { useState, type ReactNode } from "react";

import { buttonClasses, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PlanDefinition } from "@/server/billing/plans";

/** Plan cards with a monthly/annual switch. The caller decides what each card's button does. */
export function PlanGrid({
  plans,
  highlight = "pro",
  cta,
}: {
  plans: PlanDefinition[];
  highlight?: PlanDefinition["id"];
  cta: (plan: PlanDefinition, annual: boolean) => ReactNode;
}) {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="mx-auto inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <legend className="sr-only">Billing period</legend>
        {[
          { value: false, label: "Monthly" },
          { value: true, label: "Annual (2 months free)" },
        ].map((option) => (
          <label
            key={option.label}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5",
              annual === option.value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name="billing-period"
              className="sr-only"
              checked={annual === option.value}
              onChange={() => setAnnual(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <div className={cn("grid gap-6", plans.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {plans.map((plan) => {
          const price = annual ? plan.priceAnnualUsd : plan.priceMonthlyUsd;
          return (
            <Card key={plan.id} className={cn("flex flex-col", plan.id === highlight && "border-primary ring-1 ring-primary")}>
              <p className="text-sm font-semibold text-primary">{plan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-4 text-3xl font-semibold">
                ${price}
                <span className="text-sm font-normal text-muted-foreground">
                  {plan.id === "free" ? " forever" : annual ? " / year" : " / month"}
                </span>
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                <li>
                  {plan.limits.keyword} keyword reports {plan.window === "lifetime" ? "to start" : "per month"}
                </li>
                <li>
                  {plan.limits.visibility} visibility scans {plan.window === "lifetime" ? "to start" : "per month"}
                </li>
                <li>Report history and live progress</li>
                <li className={plan.insights ? "" : "text-muted-foreground line-through"}>
                  AI insights, content plans and recommendations
                </li>
              </ul>
              <div className="mt-6">{cta(plan, annual)}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Marketing pricing: every button leads to sign-up. */
export function PricingTable({ plans, ctaHref }: { plans: PlanDefinition[]; ctaHref: string }) {
  return (
    <PlanGrid
      plans={plans}
      cta={(plan) => (
        <a href={ctaHref} className={buttonClasses(plan.id === "pro" ? "primary" : "secondary", "md", "w-full")}>
          {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
        </a>
      )}
    />
  );
}
