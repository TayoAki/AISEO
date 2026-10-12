import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { KeywordReport } from "@/components/reports/keyword-report";
import { LiveProgress } from "@/components/reports/live-progress";
import { isActiveStatus, REPORT_TYPE_LABEL, StatusBadge } from "@/components/reports/meta";
import { VisibilityReport } from "@/components/reports/visibility-report";
import { Alert, Badge, ButtonLink, Card } from "@/components/ui";
import { countryName, hostnameOf, type ReportInput } from "@/lib/report-input";
import { formatDate } from "@/lib/utils";
import { getDb } from "@/server/db/client";
import { getReportForUser } from "@/server/reports/queries";
import { serializeReport, type ReportDTO } from "@/server/reports/serialize";
import { UUID_PATTERN } from "@/server/web/api";
import { getViewer } from "@/server/web/session";

export const metadata: Metadata = { title: "Report" };

function InputSummary({ input }: { input: ReportInput }) {
  if (input.type === "keyword") {
    return (
      <>
        Keyword <strong className="text-foreground">{input.keyword}</strong> in {countryName(input.country)}
      </>
    );
  }
  return (
    <>
      <strong className="text-foreground">{input.brand}</strong> ({hostnameOf(input.website)}) for “{input.topic}”
    </>
  );
}

/** Link back to the right form, prefilled with the same input. */
function retryHref(input: ReportInput | null): string {
  if (!input) return "/dashboard";
  const params =
    input.type === "keyword"
      ? new URLSearchParams({ keyword: input.keyword, country: input.country })
      : new URLSearchParams({ website: input.website, brand: input.brand, topic: input.topic });
  return `/${input.type === "keyword" ? "keywords" : "visibility"}?${params.toString()}`;
}

function FailureCard({ report }: { report: ReportDTO }) {
  return (
    <Card className="flex flex-col items-start gap-4">
      <Alert tone="danger" title="This report couldn't be completed">
        {report.error?.message ?? "Something went wrong. Your credit has been refunded."}
      </Alert>
      <ButtonLink href={retryHref(report.input)}>Try again</ButtonLink>
    </Card>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const { user, entitlements } = await getViewer();
  const row = await getReportForUser(getDb(), user.id, id);
  if (!row) notFound();
  const report = serializeReport(row, entitlements);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/reports" className="text-sm text-muted-foreground hover:text-foreground">
          ← All reports
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{report.title}</h1>
          {/* While running, the live card below carries the up-to-date status. */}
          {isActiveStatus(report.status) ? <Badge tone="info">In progress</Badge> : <StatusBadge status={report.status} />}
        </div>
        <p className="text-sm text-muted-foreground">
          {REPORT_TYPE_LABEL[report.type]}
          {report.input ? (
            <>
              {" · "}
              <InputSummary input={report.input} />
            </>
          ) : null}
          {" · "}
          {formatDate(report.createdAt)}
        </p>
      </div>

      {isActiveStatus(report.status) ? (
        <LiveProgress
          initial={{ id: report.id, status: report.status, progress: report.progress, step: report.step, error: report.error }}
        />
      ) : null}

      {report.status === "failed" || report.status === "canceled" ? <FailureCard report={report} /> : null}

      {report.status === "completed" && report.keyword ? (
        <KeywordReport result={report.keyword} insights={report.insights} />
      ) : null}
      {report.status === "completed" && report.visibility ? (
        <VisibilityReport
          result={report.visibility}
          insights={report.insights}
          brand={report.input?.type === "visibility" ? report.input.brand : "your brand"}
        />
      ) : null}
      {report.status === "completed" && !report.keyword && !report.visibility ? (
        <Alert tone="warning">This report&apos;s results couldn&apos;t be displayed. Please contact support.</Alert>
      ) : null}
    </div>
  );
}
