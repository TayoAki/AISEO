import type { Metadata } from "next";
import Link from "next/link";

import { ReportList } from "@/components/reports/report-list";
import { ButtonLink, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getDb } from "@/server/db/client";
import { listReportsForUser } from "@/server/reports/queries";
import { serializeReportSummary } from "@/server/reports/serialize";
import { getViewer } from "@/server/web/session";

export const metadata: Metadata = { title: "Report history" };

const TABS = [
  { type: null, label: "All" },
  { type: "keyword", label: "Keyword reports" },
  { type: "visibility", label: "Visibility scans" },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hrefFor(type: string | null, cursor?: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `/reports?${query}` : "/reports";
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = params.type === "keyword" || params.type === "visibility" ? params.type : null;
  const cursor = typeof params.cursor === "string" ? params.cursor : null;

  const { user } = await getViewer();
  const page = await listReportsForUser(getDb(), user.id, { cursor, type, limit: 20 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Report history" description="Every report you've run, newest first." />

      <nav aria-label="Filter reports" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={hrefFor(tab.type)}
            aria-current={tab.type === type ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              tab.type === type ? "border-primary bg-accent font-medium text-primary" : "border-border hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <ReportList
        reports={page.items.map(serializeReportSummary)}
        empty={
          cursor ? (
            <p>No older reports.</p>
          ) : (
            <p>
              Start with a <Link href="/keywords" className="font-medium text-primary">keyword report</Link> or a{" "}
              <Link href="/visibility" className="font-medium text-primary">visibility scan</Link>.
            </p>
          )
        }
      />

      <div className="flex justify-between">
        {cursor ? (
          <ButtonLink href={hrefFor(type)} variant="ghost" size="sm">
            Back to newest
          </ButtonLink>
        ) : (
          <span />
        )}
        {page.nextCursor ? (
          <ButtonLink href={hrefFor(type, page.nextCursor)} variant="secondary" size="sm">
            Older reports
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
