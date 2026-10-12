import { z } from "zod";

import { reportInputSchema } from "@/lib/report-input";
import { getEntitlements } from "@/server/billing/entitlements";
import { featureLabel } from "@/server/billing/plans";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { getWebBoss } from "@/server/pipeline/boss";
import { createReport } from "@/server/reports/create";
import { getReportForUser, listReportsForUser } from "@/server/reports/queries";
import { serializeReport, serializeReportSummary } from "@/server/reports/serialize";
import { clientIp, fail, ok, requireApiUser } from "@/server/web/api";
import { verifyTurnstile } from "@/server/web/turnstile";

export const dynamic = "force-dynamic";

const createBodySchema = z.object({
  input: z.unknown(),
  /** Client-generated per form submission so double-clicks and retries create one report. */
  idempotencyKey: z.string().trim().min(8).max(100),
  turnstileToken: z.string().max(4096).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if ("error" in auth) return auth.error;

  const json: unknown = await request.json().catch(() => null);
  const body = createBodySchema.safeParse(json);
  if (!body.success) return fail(400, "INVALID_REQUEST", "The request was malformed.");

  const input = reportInputSchema.safeParse(body.data.input);
  if (!input.success) {
    return fail(400, "INVALID_INPUT", "Check the highlighted fields.", z.flattenError(input.error).fieldErrors);
  }

  const env = getEnv();
  const db = getDb();
  const entitlements = await getEntitlements(db, auth.user.id);

  // Free reports cost real money: require a human check on every one.
  if (!entitlements.isPaid) {
    const human = await verifyTurnstile(body.data.turnstileToken, clientIp(request, env.TRUSTED_IP_HEADER));
    if (!human) return fail(403, "CAPTCHA_FAILED", "Please complete the security check and try again.");
  }

  const result = await createReport(
    { db, boss: await getWebBoss() },
    {
      userId: auth.user.id,
      input: input.data,
      idempotencyKey: body.data.idempotencyKey,
      entitlements,
      now: new Date(),
      maxActiveReports: env.MAX_ACTIVE_REPORTS_PER_USER,
    },
  );

  switch (result.status) {
    case "limit_reached":
      return fail(
        403,
        "LIMIT_REACHED",
        entitlements.isPaid
          ? `You've used this month's ${featureLabel(result.feature).toLowerCase()}. Upgrade or wait for your allowance to reset.`
          : `You've used your free ${featureLabel(result.feature).toLowerCase()}. Upgrade to keep going.`,
      );
    case "too_many_active":
      return fail(
        429,
        "TOO_MANY_ACTIVE",
        `You can run ${result.limit} reports at a time. Wait for one to finish and try again.`,
      );
    case "created":
    case "duplicate": {
      const row = await getReportForUser(db, auth.user.id, result.reportId);
      if (!row) return fail(500, "INTERNAL", "The report was created but could not be loaded.");
      return ok({ report: serializeReport(row, entitlements) }, result.status === "created" ? 202 : 200);
    }
  }
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const page = await listReportsForUser(getDb(), auth.user.id, {
    cursor: url.searchParams.get("cursor"),
    limit: Number(url.searchParams.get("limit") ?? 20) || 20,
    type: type === "keyword" || type === "visibility" ? type : null,
  });
  return ok({ reports: page.items.map(serializeReportSummary), nextCursor: page.nextCursor });
}
