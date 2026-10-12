import { eq } from "drizzle-orm";
import type { PgBoss } from "pg-boss";

import type { Database } from "../db/client";
import { reportCollection } from "../db/schema";
import { QUEUES, type ReportJobData } from "./queues";
import { verifyCollectionToken } from "./webhook-token";

export type CallbackResult = "accepted" | "unauthorized" | "unknown";

/**
 * Handles a Bright Data notification. The body is not trusted or even
 * needed: a valid token identifies the collection, and the collect job asks
 * Bright Data for the real status. Duplicates collapse onto one queued job.
 */
export async function handleCollectionCallback(
  deps: { db: Database; boss: PgBoss; signingSecret: string },
  params: { collectionId: string | null; token: string | null },
): Promise<CallbackResult> {
  const { collectionId, token } = params;
  if (!collectionId || !token || !/^[0-9a-f-]{36}$/i.test(collectionId)) return "unauthorized";
  if (!verifyCollectionToken(collectionId, token, deps.signingSecret)) return "unauthorized";

  const [collection] = await deps.db
    .select({ reportId: reportCollection.reportId })
    .from(reportCollection)
    .where(eq(reportCollection.id, collectionId))
    .limit(1);
  if (!collection) return "unknown";

  await deps.boss.send(QUEUES.collect, { reportId: collection.reportId } satisfies ReportJobData, {
    singletonKey: collection.reportId,
  });
  return "accepted";
}
