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

export const metadata: Metadata = { title: "AI search visibility" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VisibilityPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, entitlements, usage } = await getViewer();
  const params = await searchParams;
  const recent = await listReportsForUser(getDb(), user.id, { limit: 5, type: "visibility" });
  const text = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="AI search visibility"
        description="We ask ChatGPT and Gemini five neutral buyer questions in your category and measure how often they mention and cite you."
      />
      <NewReportForm
        type="visibility"
        siteKey={entitlements.isPaid ? null : publicConfig().turnstileSiteKey}
        remaining={usage.visibility.remaining}
        defaults={{ website: text("website"), brand: text("brand"), topic: text("topic") }}
      />
      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold">
            Recent visibility scans
          </h2>
          <Link href="/reports?type=visibility" className="text-sm font-medium text-primary">
            View all
          </Link>
        </div>
        <ReportList reports={recent.items.map(serializeReportSummary)} empty={<p>Your visibility scans will appear here.</p>} />
      </section>
    </div>
  );
}
