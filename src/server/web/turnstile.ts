import "server-only";

import { getEnv } from "../env";

/** Verifies a Cloudflare Turnstile token server-side. Fails closed. */
export async function verifyTurnstile(token: string | null | undefined, remoteIp: string | null): Promise<boolean> {
  if (!token) return false;
  const body = new URLSearchParams({ secret: getEnv().TURNSTILE_SECRET_KEY, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    const codes = result["error-codes"] ?? [];
    // A bad or missing secret makes every real user "fail" the check: say so loudly.
    if (codes.some((code) => code.includes("secret"))) {
      console.error("[turnstile] configuration error", { codes });
    }
    return result.success === true;
  } catch (error) {
    console.warn("[turnstile] verification unavailable", { message: (error as Error).message });
    return false;
  }
}
