/**
 * Railway infrastructure for AISEO: Postgres, the web service and the
 * pipeline worker, all built from this repository.
 *
 *   railway link              # choose the project and environment
 *   railway config plan       # preview the changes
 *   railway config apply      # apply after reviewing the plan
 *
 * Secrets use preserve(): set each value once in the Railway dashboard (or
 * with `railway variables`) and this file leaves it untouched. Step-by-step
 * setup, including the Stripe, Turnstile and Bright Data side, is in
 * docs/DEPLOY-RAILWAY.md.
 */
import { defineRailway, github, group, postgres, preserve, project, service } from "railway/iac";

// The branch Railway deploys from: every push to it redeploys both services.
const SOURCE = github("TayoAki/AISEO", { branch: "main" });

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";
  // "Postgres" is the name Railway's Postgres template gives the database.
  const db = postgres("Postgres");

  const common = {
    NODE_ENV: "production",
    DATABASE_URL: db.env.DATABASE_URL,
    // Railpack would otherwise pick the newest Node release matching engines.
    RAILPACK_NODE_VERSION: "22",
  };

  const web = service("web", {
    source: SOURCE,
    build: "npm run build",
    start: "npm run start",
    // Drizzle migrations + pg-boss schema and queues, before traffic moves.
    preDeploy: "npm run db:migrate:deploy",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    replicas: 1,
    deploy: {
      // Lets in-flight requests and live-progress streams finish on redeploy.
      drainingSeconds: 30,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
    env: {
      ...common,
      // Public URL (emails, Stripe redirects, Bright Data webhook base), set
      // to https://${{RAILWAY_PUBLIC_DOMAIN}} or your custom domain.
      APP_URL: preserve(),
      // HMAC key for Bright Data webhook URLs; the worker reads the same value.
      WEBHOOK_SIGNING_SECRET: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      TRUSTED_IP_HEADER: "x-real-ip",
      TURNSTILE_SITE_KEY: preserve(),
      TURNSTILE_SECRET_KEY: preserve(),
      RESEND_API_KEY: preserve(),
      EMAIL_FROM: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      STRIPE_PRICE_PRO_MONTHLY: preserve(),
      STRIPE_PRICE_PRO_ANNUAL: preserve(),
      STRIPE_PRICE_PLUS_MONTHLY: preserve(),
      STRIPE_PRICE_PLUS_ANNUAL: preserve(),
      // Accounts that can open /admin/costs (comma-separated emails).
      ADMIN_EMAILS: preserve(),
      MAX_ACTIVE_REPORTS_PER_USER: "3",
      MAX_FAILED_REPORTS_PER_DAY: "5",
    },
  });

  const worker = service("worker", {
    source: SOURCE,
    // The worker only needs the bundled dist/worker.js, not the Next.js build.
    build: "npm run build:node",
    start: "npm run start:worker",
    replicas: 1,
    deploy: {
      // pg-boss stops taking jobs on SIGTERM and waits up to 25 s for running ones.
      drainingSeconds: 45,
      restartPolicyType: "ALWAYS",
    },
    env: {
      ...common,
      // Always identical to the web service's values.
      APP_URL: web.env.APP_URL,
      WEBHOOK_SIGNING_SECRET: web.env.WEBHOOK_SIGNING_SECRET,
      ANTHROPIC_API_KEY: preserve(),
      // Sonnet 5.5 costs about half of Opus 5.5 per report ("claude-opus-5-5" for maximum depth).
      ANTHROPIC_MODEL: "claude-sonnet-5-5",
      ANTHROPIC_EFFORT: "medium",
      BRIGHTDATA_API_TOKEN: preserve(),
      // Your Bright Data rate, for cost reporting only (report_usage).
      BRIGHTDATA_COST_PER_1K_RECORDS: "1.5",
      WORKER_CONCURRENCY: production ? "4" : "2",
    },
  });

  return project("aiseo", {
    resources: group("AISEO", [db, web, worker]),
  });
});
