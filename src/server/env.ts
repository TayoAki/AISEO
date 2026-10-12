import { z } from "zod";

/**
 * Runtime configuration, validated on first use rather than at import time so
 * `next build` works without secrets. Production refuses to start with test
 * defaults (fake providers, Turnstile test keys, dev secrets).
 */

// Cloudflare's documented always-pass test keys, used outside production only.
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
const DEV_SECRET = "dev-only-secret-change-me-0123456789abcdef";

const boolish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    BETTER_AUTH_SECRET: z.string().min(32).default(DEV_SECRET),
    /** Header that carries the real client IP behind the platform proxy. */
    TRUSTED_IP_HEADER: z.string().default("x-real-ip"),

    TURNSTILE_SITE_KEY: z.string().default(TURNSTILE_TEST_SITE_KEY),
    TURNSTILE_SECRET_KEY: z.string().default(TURNSTILE_TEST_SECRET_KEY),

    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("AISEO <no-reply@localhost>"),

    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
    STRIPE_PRICE_PLUS_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PLUS_ANNUAL: z.string().optional(),

    /** `fake` simulates Bright Data and Claude locally; refused in production. */
    PROVIDER_MODE: z.enum(["live", "fake"]).optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
    ANTHROPIC_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
    /** Server-side refusal fallback (Claude API only). */
    ANTHROPIC_REFUSAL_FALLBACK: boolish.default(true),

    BRIGHTDATA_API_TOKEN: z.string().optional(),
    BRIGHTDATA_DATASET_PERPLEXITY: z.string().default("gd_m7dhdot1vw9a7gc1n"),
    BRIGHTDATA_DATASET_CHATGPT: z.string().default("gd_m7aof0k82r803d5bjm"),
    BRIGHTDATA_DATASET_GEMINI: z.string().default("gd_mbz66arm2mf9cu856y"),
    /** Let ChatGPT browse so answers carry citations (visibility scoring needs them). */
    BRIGHTDATA_CHATGPT_WEB_SEARCH: boolish.default(true),

    /** HMAC key for webhook URL tokens (Bright Data deliveries). */
    WEBHOOK_SIGNING_SECRET: z.string().min(32).default(DEV_SECRET),

    MAX_ACTIVE_REPORTS_PER_USER: z.coerce.number().int().min(1).max(20).default(3),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
    /** Minutes to wait for Bright Data before polling, then failing. */
    COLLECTION_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(120).default(16),
    COLLECTION_MAX_WAIT_MINUTES: z.coerce.number().int().min(10).max(240).default(45),
  })
  .transform((env) => ({
    ...env,
    PROVIDER_MODE:
      env.PROVIDER_MODE ?? (env.NODE_ENV === "production" ? ("live" as const) : ("fake" as const)),
    billingEnabled: Boolean(env.STRIPE_SECRET_KEY),
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    const problems: string[] = [];
    if (env.BETTER_AUTH_SECRET === DEV_SECRET) problems.push("BETTER_AUTH_SECRET must be set");
    if (env.WEBHOOK_SIGNING_SECRET === DEV_SECRET) problems.push("WEBHOOK_SIGNING_SECRET must be set");
    if (env.TURNSTILE_SECRET_KEY === TURNSTILE_TEST_SECRET_KEY)
      problems.push("TURNSTILE_SECRET_KEY must be a real key");
    if (env.PROVIDER_MODE === "fake") problems.push("PROVIDER_MODE=fake is not allowed");
    if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY must be set");
    if (!env.ANTHROPIC_API_KEY) problems.push("ANTHROPIC_API_KEY must be set");
    if (!env.BRIGHTDATA_API_TOKEN) problems.push("BRIGHTDATA_API_TOKEN must be set");
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) problems.push("Stripe keys must be set");
    for (const key of [
      "STRIPE_PRICE_PRO_MONTHLY",
      "STRIPE_PRICE_PRO_ANNUAL",
      "STRIPE_PRICE_PLUS_MONTHLY",
      "STRIPE_PRICE_PLUS_ANNUAL",
    ] as const) {
      if (!env[key]) problems.push(`${key} must be set`);
    }
    if (!env.APP_URL.startsWith("https://")) problems.push("APP_URL must be https in production");
    for (const message of problems) ctx.addIssue({ code: "custom", message });
  });

export type Env = z.output<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}
