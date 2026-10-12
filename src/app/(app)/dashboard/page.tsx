import type { Metadata } from "next";
import Link from "next/link";

import { ReportList } from "@/components/reports/report-list";
import { UsageMeter } from "@/components/reports/usage-meter";
import { Alert, ButtonLink, Card, PageHeader } from "@/components/ui";
import { formatDay } from "@/lib/utils";
import { PLANS } from "@/server/billing/plans";
import { getDb } from "@/server/db/client";
import { listReportsForUser } from "@/server/reports/queries";
import { serializeReportSummary } from "@/server/reports/serialize";
import { getViewer } from "@/server/web/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, entitlements, usage } = await getViewer();
  const recent = await listReportsForUser(getDb(), user.id, { limit: 5 });
  const subscription = entitlements.subscription;
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Research keywords in AI answers and check whether assistants recommend your brand."
        actions={
          <>
            <ButtonLink href="/keywords">New keyword report</ButtonLink>
            <ButtonLink href="/visibility" variant="secondary">
              New visibility scan
            </ButtonLink>
          </>
        }
      />

      {subscription?.status === "past_due" ? (
        <Alert tone="warning" title="Your last payment failed">
          Stripe will retry automatically. Update your card in{" "}
          <Link href="/billing" className="font-medium underline">
            billing
          </Link>{" "}
          to keep your {PLANS[entitlements.plan].name} plan.
        </Alert>
      ) : null}
      {subscription?.cancelAtPeriodEnd && subscription.periodEnd ? (
        <Alert tone="info">
          Your {PLANS[entitlements.plan].name} plan ends on {formatDay(subscription.periodEnd)}. You can resume it from{" "}
          <Link href="/billing" className="font-medium underline">
            billing
          </Link>
          .
        </Alert>
      ) : null}

      <section aria-labelledby="usage" className="flex flex-col gap-3">
        <h2 id="usage" className="text-lg font-semibold">
          Your allowance
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <UsageMeter usage={usage.keyword} />
          <UsageMeter usage={usage.visibility} />
        </div>
      </section>

      {!entitlements.isPaid ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Unlock AI insights and monthly reports</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pro adds {PLANS.pro.limits.keyword} keyword reports and {PLANS.pro.limits.visibility} visibility scans a
              month, plus content plans and recommendations on every report.
            </p>
          </div>
          <ButtonLink href="/billing" className="shrink-0">
            See plans
          </ButtonLink>
        </Card>
      ) : null}

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold">
            Recent reports
          </h2>
          {recent.items.length > 0 ? (
            <Link href="/reports" className="text-sm font-medium text-primary">
              View all
            </Link>
          ) : null}
        </div>
        <ReportList
          reports={recent.items.map(serializeReportSummary)}
          empty={<p>Run your first keyword report or visibility scan to see it here.</p>}
        />
      </section>
    </div>
  );
}
