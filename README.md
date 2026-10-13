# AISEO

Keyword research and AI search visibility for marketers. AISEO collects live answers from Perplexity, ChatGPT and Gemini, then shows which sources and competitors those answers rely on and whether they mention your brand.

- **Keyword reports**: opportunity score, most-cited domains, source mix, competing brands, prompts to target and keyword clusters for any keyword in 20 markets.
- **AI visibility scans**: five neutral buyer questions on ChatGPT and Gemini, scored by how often your brand is mentioned and your site cited, prompt by prompt.
- **Plans**: Free (2 + 2 reports, once), Pro and Plus (monthly allowances plus AI insights and recommendations), billed through Stripe. Failed reports never use a credit.
- **Admin cost page**: `/admin/costs` shows revenue, what each report really costs, margins per plan and a what-if calculator, for the accounts listed in `ADMIN_EMAILS`.

This is a ground-up rebuild of the RankSEO tutorial app with a simpler, more robust architecture. The review of the original is in [`docs/rankseo-review`](docs/rankseo-review/ARCHITECTURE-REVIEW.md), and the platform decision in [`reports/`](reports/InsForge%20vs%20Better%20Auth%20and%20Railway.md).

## Architecture

| Layer | Choice |
|---|---|
| Web app | Next.js 16 (App Router, React 19), Tailwind CSS 4 |
| Auth | Better Auth (email + password, required email verification, Turnstile, Postgres-backed rate limits) |
| Billing | Better Auth Stripe plugin (Checkout, billing portal, webhooks) |
| Data | Postgres via Drizzle ORM; quotas enforced with row-level atomic updates |
| Jobs | pg-boss on the same Postgres (no Redis): idempotent pipeline jobs, dead letters, a reconciler cron |
| Live progress | Server-sent events fed by Postgres `LISTEN/NOTIFY` |
| AI answers | Bright Data scrapers (Perplexity, ChatGPT, Gemini) with signed webhooks |
| Analysis | Claude Sonnet 5.5 via the Anthropic SDK, schema-validated structured output; each report's real cost is recorded in `report_usage` |
| Hosting | Railway: `web` and `worker` services plus Postgres, declared in [`.railway/railway.ts`](.railway/railway.ts) |

Every user journey and background flow (sign-up to billing, retries, refunds, the reconciler) is described with diagrams in **[docs/USER-JOURNEYS.md](docs/USER-JOURNEYS.md)**.

## Run it locally

Requirements: Node.js 22.12+, Postgres 16+.

```bash
cp .env.example .env.local      # set DATABASE_URL; everything else is optional locally
npm install
npm run db:migrate              # Drizzle migrations + pg-boss schema and queues
npm run dev                     # http://localhost:3000
npm run dev:worker              # in a second terminal: the report pipeline
```

Locally, Bright Data and Claude are simulated by fake providers (including webhooks), emails print to the web server console, and Cloudflare's test Turnstile keys always pass. So you can sign up, verify, run both report types and watch live progress without any API keys. Put `simulate failure` in a keyword or topic to see a failed report get refunded.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run dev:worker` | Web app and worker in watch mode (both read `.env.local`) |
| `npm run db:migrate` | Apply migrations and set up the job queues |
| `npm run db:generate` | Generate a migration after changing `src/server/db/schema` |
| `npm test` | Unit and integration tests (needs Postgres; uses `aiseo_test`) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run build` | Production build: Next.js plus bundled `dist/worker.js` and `dist/migrate.js` |
| `npm run start` / `npm run start:worker` | Run the production web server / worker |

Tests run against a real Postgres database named `aiseo_test` (override with `DATABASE_URL`), with fake providers.

## Project layout

```
src/
  app/                 Next.js routes: (marketing), (auth), (app), api/
  components/          UI: auth forms, report views, billing, settings
  lib/                 Shared client/server code (input schemas, auth client)
  server/
    auth/              Better Auth config, email policy
    billing/           Plans, entitlements, Stripe event handling
    db/                Drizzle schema, client, migration runner
    email/             Resend sender and templates
    pipeline/          Report jobs, Bright Data + Claude clients, analysis
    quota/             Credit reservation and monthly windows
    reports/           Create, query, serialize (paywall), state machine
    web/               Session helpers, API envelope, SSE listener, Turnstile
  worker/index.ts      Worker entrypoint (pg-boss handlers + reconciler cron)
  proxy.ts             Cookie-based redirects for signed-in routes
drizzle/               SQL migrations
tests/                 Vitest unit and integration tests
.railway/railway.ts    Railway infrastructure as code
docs/                  User journeys, deployment guide, original app review
```

## Deploy

See **[docs/DEPLOY-RAILWAY.md](docs/DEPLOY-RAILWAY.md)**: create the project from `.railway/railway.ts`, set secrets per service, and configure Stripe, Turnstile, Resend, Bright Data and Anthropic.
