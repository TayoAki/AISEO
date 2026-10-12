import type { Metadata } from "next";
import Link from "next/link";

import { NewReportForm } from "@/components/reports/new-report-form";
import { ReportList } from "@/components/reports/report-list";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/server/db/client";
import { publicConfig } from "@/server/public-config";
import { listReportsForUser } from "@/server/reports/queries";
import { serializeReportSummary } from "@/server/reports/serialize";
import { getViewer } from "@/server/web/session";

export const metadata: Metadata = { title: "Keyword research" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function KeywordsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, entitlements, usage } = await getViewer();
  const params = await searchParams;
  const recent = await listReportsForUser(getDb(), user.id, { limit: 5, type: "keyword" });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Keyword research"
        description="See which sources, brands and questions dominate AI answers for a keyword in your market."
      />
      <NewReportForm
        type="keyword"
        siteKey={entitlements.isPaid ? null : publicConfig().turnstileSiteKey}
        remaining={usage.keyword.remaining}
        defaults={{
          keyword: typeof params.keyword === "string" ? params.keyword : undefined,
          country: typeof params.country === "string" ? params.country : undefined,
        }}
      />
      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold">
            Recent keyword reports
          </h2>
          <Link href="/reports?type=keyword" className="text-sm font-medium text-primary">
            View all
          </Link>
        </div>
        <ReportList reports={recent.items.map(serializeReportSummary)} empty={<p>Your keyword reports will appear here.</p>} />
      </section>
    </div>
  );
}
