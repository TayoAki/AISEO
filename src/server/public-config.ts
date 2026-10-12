/**
 * Public, non-secret settings passed from server components to client
 * components at request time (so they aren't baked in at build time).
 */
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

export function publicConfig() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey && process.env.NODE_ENV === "production") {
    throw new Error("TURNSTILE_SITE_KEY must be set in production");
  }
  return {
    turnstileSiteKey: siteKey ?? TURNSTILE_TEST_SITE_KEY,
    billingEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNextPath(value: string | string[] | undefined, fallback = "/dashboard"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  return candidate;
}
