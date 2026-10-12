import { getEnv } from "./env";

/**
 * Public, non-secret settings passed from server components to client
 * components at request time (so they aren't baked in at build time).
 */
export function publicConfig() {
  const env = getEnv();
  return { turnstileSiteKey: env.TURNSTILE_SITE_KEY, billingEnabled: env.billingEnabled };
}

const PLACEHOLDER_ORIGIN = "https://aiseo.invalid";

/**
 * Only allow same-site relative redirects (prevents open redirects). Browsers
 * strip tabs and newlines and treat backslashes as slashes, so "/\t/evil.com"
 * would become "//evil.com": control characters and backslashes are rejected,
 * and the result must still resolve to our own origin.
 */
export function safeNextPath(value: string | string[] | undefined, fallback = "/dashboard"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;
  try {
    const url = new URL(candidate, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
