import { getEntitlements } from "@/server/billing/entitlements";
import { getDb } from "@/server/db/client";
import { getReportForUser } from "@/server/reports/queries";
import { serializeReport } from "@/server/reports/serialize";
import { fail, ok, requireApiUser, UUID_PATTERN } from "@/server/web/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return fail(404, "NOT_FOUND", "Report not found.");

  const db = getDb();
  const row = await getReportForUser(db, auth.user.id, id);
  if (!row) return fail(404, "NOT_FOUND", "Report not found.");

  return ok({ report: serializeReport(row, await getEntitlements(db, auth.user.id)) });
}
