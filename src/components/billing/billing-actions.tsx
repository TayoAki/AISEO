"use client";

import { useState } from "react";

import { PlanGrid } from "@/components/pricing-table";
import { Alert, Button, Spinner } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import type { PaidPlanId, PlanDefinition, PlanId } from "@/server/billing/plans";

/**
 * Upgrade and plan-change buttons. New subscribers go to Stripe Checkout;
 * existing subscribers confirm the change in the Stripe billing portal.
 * The Better Auth client follows the returned redirect URL.
 */
export function BillingPlans({
  plans,
  currentPlan,
  currentInterval,
}: {
  plans: PlanDefinition[];
  currentPlan: PlanId;
  /** Stripe's billing interval for the current subscription ("month" or "year"). */
  currentInterval: string | null;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(plan: PaidPlanId, annual: boolean) {
    setPending(`${plan}-${annual}`);
    setError(null);
    const { error: upgradeError } = await authClient.subscription.upgrade({
      plan,
      annual,
      successUrl: "/billing?checkout=success",
      cancelUrl: "/billing?checkout=canceled",
      returnUrl: "/billing",
    });
    if (upgradeError) {
      setPending(null);
      setError(upgradeError.message ?? "We couldn't start checkout. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <PlanGrid
        plans={plans}
        highlight={currentPlan === "free" ? "pro" : currentPlan}
        cta={(plan, annual) => {
          if (plan.id === "free") return null;
          const id = plan.id;
          const samePlan = id === currentPlan;
          const sameInterval = annual ? currentInterval === "year" : currentInterval !== "year";
          if (samePlan && sameInterval) {
            return (
              <Button className="w-full" variant="secondary" disabled>
                Current plan
              </Button>
            );
          }
          const label = samePlan
            ? `Switch to ${annual ? "annual" : "monthly"} billing`
            : currentPlan === "free"
              ? `Upgrade to ${plan.name}`
              : `Switch to ${plan.name}`;
          return (
            <Button
              className="w-full"
              variant={samePlan ? "secondary" : "primary"}
              disabled={pending !== null}
              onClick={() => void choose(id, annual)}
            >
              {pending === `${id}-${annual}` ? <Spinner /> : null}
              {label}
            </Button>
          );
        }}
      />
    </div>
  );
}

export function ManageBillingButton({ label = "Manage billing" }: { label?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const { error: portalError } = await authClient.subscription.billingPortal({ returnUrl: "/billing" });
          if (portalError) {
            setPending(false);
            setError(portalError.message ?? "We couldn't open the billing portal. Please try again.");
          }
        }}
      >
        {pending ? <Spinner /> : null}
        {label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
