import { and, desc, eq, lt, or } from "drizzle-orm";

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

export type ReportPage = { items: ReportRow[]; nextCursor: string | null };

function encodeCursor(row: ReportRow): string {
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

/** Keyset pagination, newest first. */
export async function listReportsForUser(
  db: Executor,
  userId: string,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<ReportPage> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  const rows = (await db
    .select(reportColumns)
    .from(report)
    .where(
      and(
        eq(report.userId, userId),
        cursor
          ? or(
              lt(report.createdAt, cursor.createdAt),
              and(eq(report.createdAt, cursor.createdAt), lt(report.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(report.createdAt), desc(report.id))
    .limit(limit + 1)) as ReportRow[];

  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
}
