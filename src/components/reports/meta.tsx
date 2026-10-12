import { Badge } from "@/components/ui";
import type { ReportDTO } from "@/server/reports/serialize";

export const REPORT_TYPE_LABEL: Record<ReportDTO["type"], string> = {
  keyword: "Keyword report",
  visibility: "Visibility scan",
};

const STATUS: Record<ReportDTO["status"], { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  queued: { label: "Queued", tone: "neutral" },
  collecting: { label: "Collecting answers", tone: "info" },
  analyzing: { label: "Analyzing", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed · credit refunded", tone: "danger" },
  canceled: { label: "Canceled · credit refunded", tone: "neutral" },
};

export function StatusBadge({ status }: { status: ReportDTO["status"] }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function isActiveStatus(status: ReportDTO["status"]): boolean {
  return status === "queued" || status === "collecting" || status === "analyzing";
}

/** Shared colour scale for 0-100 scores. */
export function scoreTone(score: number): "danger" | "warning" | "info" | "success" {
  if (score < 35) return "danger";
  if (score < 65) return "warning";
  if (score < 85) return "info";
  return "success";
}
