import Link from "next/link";

import { Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { ReportSummaryDTO } from "@/server/reports/serialize";

import { isActiveStatus, REPORT_TYPE_LABEL, scoreTone, StatusBadge } from "./meta";

export function ReportList({ reports, empty }: { reports: ReportSummaryDTO[]; empty: React.ReactNode }) {
  if (reports.length === 0) return <EmptyState title="No reports yet">{empty}</EmptyState>;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {reports.map((report) => (
        <li key={report.id}>
          <Link
            href={`/reports/${report.id}`}
            className="flex flex-col gap-2 px-5 py-4 hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{report.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {REPORT_TYPE_LABEL[report.type]} · {formatDate(report.createdAt)}
                {isActiveStatus(report.status) ? ` · ${report.step}` : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {report.status === "completed" && report.score !== null ? (
                <Badge tone={scoreTone(report.score)}>
                  {report.score}/100{report.scoreLabel ? ` · ${report.scoreLabel}` : null}
                </Badge>
              ) : (
                <StatusBadge status={report.status} />
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
