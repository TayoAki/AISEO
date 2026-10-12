import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import type { Executor } from "../db/client";
import { report } from "../db/schema";

/** Columns the app reads for a report; failureDetail is deliberately excluded. */
const reportColumns = {
  id: report.id,
  userId: report.userId,
  type: report.type,
  status: report.status,
  progress: report.progress,
  step: report.step,
  title: report.title,
  input: report.input,
  tier: report.tier,
  prompts: report.prompts,
  result: report.result,
  resultVersion: report.resultVersion,
  errorCode: report.errorCode,
  errorMessage: report.errorMessage,
  createdAt: report.createdAt,
  updatedAt: report.updatedAt,
  completedAt: report.completedAt,
};

export type ReportRow = Pick<typeof report.$inferSelect, keyof typeof reportColumns>;

/** Ownership is part of the query: another user's id simply returns null. */
export async function getReportForUser(db: Executor, userId: string, reportId: string): Promise<ReportRow | null> {
  const [row] = await db
    .select(reportColumns)
    .from(report)
    .where(and(eq(report.id, reportId), eq(report.userId, userId)))
    .limit(1);
  return (row as ReportRow | undefined) ?? null;
}

const progressColumns = {
  id: report.id,
  status: report.status,
  progress: report.progress,
  step: report.step,
  errorCode: report.errorCode,
  errorMessage: report.errorMessage,
};

export type ReportProgressRow = Pick<typeof report.$inferSelect, keyof typeof progressColumns>;

/** Just the live-progress fields, for the SSE stream (read on every update). */
export async function getReportProgressForUser(
  db: Executor,
  userId: string,
  reportId: string,
): Promise<ReportProgressRow | null> {
  const [row] = await db
    .select(progressColumns)
    .from(report)
    .where(and(eq(report.id, reportId), eq(report.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** List rows carry the headline score instead of the whole result document. */
const summaryColumns = {
  id: report.id,
  type: report.type,
  status: report.status,
  progress: report.progress,
  step: report.step,
  title: report.title,
  createdAt: report.createdAt,
  completedAt: report.completedAt,
  score: sql<number | null>`case when ${report.status} = 'completed' then (${report.result}->>'score')::int end`,
  scoreLabel: sql<string | null>`case when ${report.status} = 'completed' then ${report.result}->>'scoreLabel' end`,
};

export type ReportSummaryRow = Pick<
  typeof report.$inferSelect,
  "id" | "type" | "status" | "progress" | "step" | "title" | "createdAt" | "completedAt"
> & { score: number | null; scoreLabel: string | null };

export type ReportPage = { items: ReportSummaryRow[]; nextCursor: string | null };

function encodeCursor(row: Pick<ReportRow, "createdAt" | "id">): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const createdAt = new Date(iso ?? "");
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Keyset pagination, newest first, optionally filtered by report type. */
export async function listReportsForUser(
  db: Executor,
  userId: string,
  options: { cursor?: string | null; limit?: number; type?: ReportRow["type"] | null } = {},
): Promise<ReportPage> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const rows = (await db
    .select(summaryColumns)
    .from(report)
    .where(
      and(
        eq(report.userId, userId),
        options.type ? eq(report.type, options.type) : undefined,
        cursor
          ? or(
              lt(report.createdAt, cursor.createdAt),
              and(eq(report.createdAt, cursor.createdAt), lt(report.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(report.createdAt), desc(report.id))
    .limit(limit + 1)) as ReportSummaryRow[];

  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
}
