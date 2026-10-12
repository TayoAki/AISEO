import { NextResponse } from "next/server";

import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { getWebBoss } from "@/server/pipeline/boss";
import { handleCollectionCallback } from "@/server/pipeline/webhook-handler";

export const dynamic = "force-dynamic";

/**
 * Bright Data "notify" callback. Must answer within 30 seconds; all real work
 * happens in the collect job, which re-checks the snapshot with Bright Data.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const result = await handleCollectionCallback(
    { db: getDb(), boss: await getWebBoss(), signingSecret: getEnv().WEBHOOK_SIGNING_SECRET },
    { collectionId: url.searchParams.get("collection"), token: url.searchParams.get("token") },
  );

  if (result === "unauthorized") {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  // Unknown collections are acknowledged so Bright Data stops retrying.
  return NextResponse.json({ received: true }, { status: 200 });
}
