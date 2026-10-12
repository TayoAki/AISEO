import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Bright Data notifies us at a URL we choose per collection. The URL carries
 * an HMAC of the collection id, so only Bright Data (which received the URL
 * from us) can produce a valid callback. The callback is only a hint: the
 * pipeline re-checks the snapshot through Bright Data's API before acting.
 */
function sign(collectionId: string, secret: string): string {
  return createHmac("sha256", secret).update(`brightdata-collection:${collectionId}`).digest("base64url");
}

export function collectionWebhookUrl(appUrl: string, collectionId: string, secret: string): string {
  const url = new URL("/api/webhooks/brightdata", appUrl);
  url.searchParams.set("collection", collectionId);
  url.searchParams.set("token", sign(collectionId, secret));
  return url.toString();
}

export function verifyCollectionToken(collectionId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(sign(collectionId, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
