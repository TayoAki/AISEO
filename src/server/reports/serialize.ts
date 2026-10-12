/**
 * Builds the report payload sent to browsers. This is the paywall: paid
 * sections are removed here, on the server, for viewers whose current plan
 * doesn't include insights. Results are validated against their versioned
 * schema on the way out.
 */
import { reportInputSchema, type ReportInput } from "@/lib/report-input";

import type { Entitlements } from "../billing/entitlements";
import type { PlanId } from "../billing/plans";
import type { ReportProgressRow, ReportRow, ReportSummaryRow } from "./queries";
import {
  keywordResultSchema,
  visibilityResultSchema,
  type KeywordResult,
  type VisibilityResult,
} from "./results";

export type ReportDTO = {
  id: string;
  type: "keyword" | "visibility";
  status: "queued" | "collecting" | "analyzing" | "completed" | "failed" | "canceled";
  progress: number;
  step: string;
  title: string;
  input: ReportInput | null;
  tier: PlanId;
  prompts: string[] | null;
  createdAt: string;
  completedAt: string | null;
  error: { code: string; message: string } | null;
  keyword: KeywordResult | null;
  visibility: VisibilityResult | null;
  /**
   * locked: the viewer's plan doesn't include insights (show an upgrade prompt).
   * notGenerated: the report ran on a free plan, so insights don't exist.
   */
  insights: "included" | "locked" | "notGenerated";
};

export function serializeReport(row: ReportRow, viewer: Entitlements): ReportDTO {
  const input = reportInputSchema.safeParse(row.input);
  let keyword: KeywordResult | null = null;
  let visibility: VisibilityResult | null = null;
  let generated = false;

  if (row.status === "completed" && row.result) {
    if (row.type === "keyword") {
      const parsed = keywordResultSchema.safeParse(row.result);
      if (parsed.success) {
        const { insights: paid, ...free } = parsed.data;
        generated = Boolean(paid);
        keyword = viewer.insights ? parsed.data : free;
      } else {
        console.error("[reports] stored keyword result failed validation", { reportId: row.id });
      }
    } else {
      const parsed = visibilityResultSchema.safeParse(row.result);
      if (parsed.success) {
        const { recommendations: paid, ...free } = parsed.data;
        generated = Boolean(paid);
        visibility = viewer.insights ? parsed.data : free;
      } else {
        console.error("[reports] stored visibility result failed validation", { reportId: row.id });
      }
    }
  }
  // Free viewers never receive paid sections; paid viewers see them when they exist.
  const insights: ReportDTO["insights"] = !viewer.insights ? "locked" : generated ? "included" : "notGenerated";

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    progress: row.progress,
    step: row.step,
    title: row.title,
    input: input.success ? input.data : null,
    tier: row.tier,
    prompts: row.prompts ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    error:
      row.status === "failed" || row.status === "canceled"
        ? { code: row.errorCode ?? "INTERNAL", message: row.errorMessage ?? "This report failed." }
        : null,
    keyword,
    visibility,
    insights,
  };
}

/** Lightweight shape for live progress events. */
export type ReportProgressDTO = Pick<ReportDTO, "id" | "status" | "progress" | "step" | "error">;

export function serializeProgress(row: ReportProgressRow): ReportProgressDTO {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    step: row.step,
    error:
      row.status === "failed" || row.status === "canceled"
        ? { code: row.errorCode ?? "INTERNAL", message: row.errorMessage ?? "This report failed." }
        : null,
  };
}

/** Row in report lists (dashboard, history): no result document, just the headline score. */
export type ReportSummaryDTO = Pick<
  ReportDTO,
  "id" | "type" | "status" | "progress" | "step" | "title" | "createdAt" | "completedAt"
> & { score: number | null; scoreLabel: string | null };

export function serializeReportSummary(row: ReportSummaryRow): ReportSummaryDTO {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    progress: row.progress,
    step: row.step,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    score: row.score,
    scoreLabel: row.scoreLabel,
  };
}
