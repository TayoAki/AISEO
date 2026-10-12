import type { Metadata } from "next";

import { BillingPlans, ManageBillingButton } from "@/components/billing/billing-actions";
import { UsageMeter } from "@/components/reports/usage-meter";
import { Alert, Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import { formatDay } from "@/lib/utils";
import { PLANS } from "@/server/billing/plans";
import { publicConfig } from "@/server/public-config";
import { getViewer } from "@/server/web/session";

export const metadata: Metadata = { title: "Billing" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed",
};

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const { entitlements, usage } = await getViewer();
  const params = await searchParams;
  const { billingEnabled } = publicConfig();
  const plan = PLANS[entitlements.plan];
  const subscription = entitlements.subscription;
  const annual = subscription?.billingInterval === "year";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Billing" description="Your plan, allowance and payment details." />

      {params.checkout === "success" ? (
        <Alert tone="success" title="Thanks for subscribing">
          Your plan is active. If it doesn&apos;t show yet, refresh in a few seconds while Stripe confirms the payment.
        </Alert>
      ) : null}
      {params.checkout === "canceled" ? <Alert tone="info">Checkout was canceled. You haven&apos;t been charged.</Alert> : null}
      {!billingEnabled ? (
        <Alert tone="warning" title="Billing is not configured">
          Set the STRIPE_* environment variables to enable checkout in this environment.
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Current plan</CardTitle>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold">{plan.name}</p>
            {subscription ? (
              <Badge tone={subscription.status === "past_due" ? "danger" : "success"}>
                {STATUS_LABEL[subscription.status] ?? subscription.status}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {subscription
              ? `$${annual ? plan.priceAnnualUsd : plan.priceMonthlyUsd} per ${annual ? "year" : "month"}. ${
                  subscription.periodEnd
                    ? subscription.cancelAtPeriodEnd
                      ? `Ends on ${formatDay(subscription.periodEnd)}; you'll move to the Free plan after that.`
                      : `Renews on ${formatDay(subscription.periodEnd)}.`
                    : ""
                }`
              : "Free forever. Your free reports don't reset; upgrade for monthly allowances and AI insights."}
          </p>
          {subscription?.status === "past_due" ? (
            <p className="text-sm text-destructive">
              Your last payment failed. Stripe will retry; update your card to keep your plan.
            </p>
          ) : null}
        </div>
        {subscription && billingEnabled ? (
          <ManageBillingButton label={subscription.status === "past_due" ? "Update payment method" : "Manage billing"} />
        ) : null}
      </Card>

      <section aria-labelledby="allowance" className="flex flex-col gap-3">
        <h2 id="allowance" className="text-lg font-semibold">
          Allowance
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <UsageMeter usage={usage.keyword} />
          <UsageMeter usage={usage.visibility} />
        </div>
        {entitlements.isPaid ? (
          <p className="text-xs text-muted-foreground">
            Paid allowances reset every month on your billing date, including on annual plans. Unused reports don&apos;t
            roll over. Changing plan gives you the new plan&apos;s full allowance straight away.
          </p>
        ) : null}
      </section>

      {billingEnabled ? (
        <section aria-labelledby="plans" className="flex flex-col gap-3">
          <h2 id="plans" className="text-lg font-semibold">
            {entitlements.isPaid ? "Change plan" : "Upgrade"}
          </h2>
          <BillingPlans
            plans={[PLANS.pro, PLANS.plus]}
            currentPlan={entitlements.plan}
            currentInterval={subscription?.billingInterval ?? null}
          />
          <p className="text-xs text-muted-foreground">
            Payments are handled by Stripe. Cancel any time from Manage billing; you keep your plan until the end of the
            period you&apos;ve paid for.
          </p>
        </section>
      ) : null}
    </div>
  );
}
