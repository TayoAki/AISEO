import { getEnv } from "./env";

/**
 * Public, non-secret settings passed from server components to client
 * components at request time (so they aren't baked in at build time).
 */
export function publicConfig() {
  const env = getEnv();
  return { turnstileSiteKey: env.TURNSTILE_SITE_KEY, billingEnabled: env.billingEnabled };
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNextPath(value: string | string[] | undefined, fallback = "/dashboard"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  return candidate;
}
