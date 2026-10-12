# Deploying AISEO on Railway

AISEO runs as three Railway resources built from this one repository:

| Resource | What it runs | Start command |
|---|---|---|
| `Postgres` | Postgres (app data, pg-boss job queue, LISTEN/NOTIFY) | managed by Railway |
| `web` | Next.js pages and APIs, auth, Stripe and Bright Data webhooks, live progress | `npm run start` |
| `worker` | Report pipeline jobs (Bright Data, Claude) and the 5-minute reconciler | `npm run start:worker` |

The whole layout is declared in [`.railway/railway.ts`](../.railway/railway.ts), Railway's Infrastructure as Code format. (`railway.json` / `railway.toml` config-as-code is deprecated and stops being read on 2026-12-01, so it isn't used.)

## 1. Before you start

You need accounts and keys for:

| Service | Used for | Values |
|---|---|---|
| [Railway](https://railway.com) | Hosting | CLI 5.42.1 or newer (`railway --version`) |
| [Stripe](https://dashboard.stripe.com) | Subscriptions | Secret key, webhook secret, 4 price ids |
| [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) | Bot protection | Site key, secret key |
| [Resend](https://resend.com) | Verification, reset and billing emails | API key, a verified sending domain |
| [Bright Data](https://brightdata.com) | Collecting answers from Perplexity, ChatGPT and Gemini | API token with Web Scraper API access |
| [Anthropic](https://console.anthropic.com) | Analysis | API key |

Merge the rebuild into the branch Railway deploys from (`main` in `.railway/railway.ts`; change `SOURCE` there if you deploy another branch or a fork). If a service deploys a different branch (set in **service → Settings → Source**), `railway config apply` moves it back to `SOURCE`.

## 2. Create the project

```bash
npm install                  # installs the railway IaC SDK (dev dependency)
railway login
railway init                 # or `railway link` to an existing, empty project
railway config plan          # review: 1 database + 2 services
railway config apply
```

The first deploys of `web` and `worker` fail with "Invalid web configuration" or "Invalid worker configuration". That's expected: their secrets aren't set yet. Each service lists exactly what is missing in its deploy logs. The web deploy fails its health check (the previous version, if any, keeps serving); the worker waits a minute after a failed start before exiting, so its restart policy retries once a minute instead of spinning.

## 3. Give the web service a domain

Run `railway domain --service web` (or `railway domain app.yourdomain.com --service web` for a custom domain), or use **web → Settings → Networking** in the dashboard. The resulting `https://…` URL is your `APP_URL`: `https://${{RAILWAY_PUBLIC_DOMAIN}}` follows the generated domain, or set the custom domain explicitly. Use the same domain for the Turnstile widget and the Stripe webhook below.

## 4. Set the secrets

Secrets are declared with `preserve()` in `.railway/railway.ts`, so the file never contains them and `railway config apply` never overwrites them. Set them once per environment, either in the dashboard (**service → Variables**) or with the CLI (`--skip-deploys` avoids a redeploy per command):

```bash
# The web service holds the public URL and both signing keys. The worker
# references its APP_URL and WEBHOOK_SIGNING_SECRET (${{web.APP_URL}}, set by
# .railway/railway.ts), so the two services always agree.
railway variable set --service web --skip-deploys \
  'APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}' \
  "WEBHOOK_SIGNING_SECRET=$(openssl rand -hex 32)" \
  "BETTER_AUTH_SECRET=$(openssl rand -hex 32)" \
  "TURNSTILE_SITE_KEY=..." "TURNSTILE_SECRET_KEY=..." \
  "RESEND_API_KEY=re_..." "EMAIL_FROM=AISEO <no-reply@yourdomain.com>" \
  "STRIPE_SECRET_KEY=sk_live_..." "STRIPE_WEBHOOK_SECRET=whsec_..." \
  "STRIPE_PRICE_PRO_MONTHLY=price_..." "STRIPE_PRICE_PRO_ANNUAL=price_..." \
  "STRIPE_PRICE_PLUS_MONTHLY=price_..." "STRIPE_PRICE_PLUS_ANNUAL=price_..."

railway variable set --service worker --skip-deploys \
  "ANTHROPIC_API_KEY=sk-ant-..." "BRIGHTDATA_API_TOKEN=..."

railway redeploy --service web --yes
railway redeploy --service worker --yes
```

Each service holds only the secrets it uses. The web service never sees provider keys; the worker never sees auth or Stripe secrets. `DATABASE_URL` is wired to the `Postgres` database by the IaC file, and `RAILPACK_NODE_VERSION=22` pins the Node major both services build with. Check what a service has with `railway variable list --service web`.

## 5. Third-party setup

### Stripe

1. **Products and prices**: create Pro ($29/month, $290/year) and Plus ($79/month, $790/year) as recurring prices. The prices shown in the app come from `src/server/billing/plans.ts`, so keep the two in sync.
2. **Webhook**: add an endpoint at `https://<APP_URL>/api/auth/stripe/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. **Customer portal** (Settings → Billing → Customer portal): allow updating payment methods, viewing invoices, canceling at period end, and switching between the four prices. Plan changes for existing subscribers go through the portal.
4. **Failed payments** (Settings → Billing → Subscriptions and emails): enable Smart Retries and choose what happens after the last retry (cancel or mark unpaid). Users keep paid access while a subscription is `past_due`.

### Cloudflare Turnstile

Create a widget for your domain (managed mode) and use its site key and secret key. Without real keys the web service refuses to start in production.

### Resend

Verify your sending domain and use an address on it for `EMAIL_FROM`. The web service refuses to start with the placeholder (`localhost` or `example.com`) sender, because Resend would reject every verification email.

### Bright Data

Create an API token with Web Scraper API access. The default dataset ids in `src/server/env.ts` are Bright Data's public Perplexity, ChatGPT and Gemini scrapers; override them with `BRIGHTDATA_DATASET_*` if you use your own. No webhook setup is needed: each collection registers its own signed notify URL under `APP_URL`.

### Anthropic

The worker uses `claude-sonnet-5-5` with `ANTHROPIC_EFFORT=medium` and Claude's server-side refusal fallback (`ANTHROPIC_REFUSAL_FALLBACK=true`; on Sonnet 5.5 it retries `cyber` and `frontier_llm` declines). `claude-opus-5-5` gives deeper analysis at about twice the cost per report; set `ANTHROPIC_MODEL` on the worker and redeploy to switch. Claude Haiku 5.5 is far cheaper but has no server-side fallback: if you try it, also set `ANTHROPIC_REFUSAL_FALLBACK=false`, and compare report quality first.

## 6. How deploys work

- **Migrations** run as the web service's pre-deploy command (`npm run db:migrate:deploy`, a bundled script). It applies the Drizzle migrations in `drizzle/` and installs or updates the pg-boss schema and queues. A failed migration stops the deploy, and the previous version keeps serving.
- **Web and worker deploy independently** on each push; Railway doesn't order them. Write migrations so the previous version of either service keeps working (add columns and tables first; remove them in a later deploy).
- **Health check**: `/api/health` runs `select 1`. The web service also checks its configuration at boot (`src/instrumentation.ts`), so a misconfigured deploy never becomes healthy.
- **Draining**: the web service gets 30 s to finish requests and close live-progress streams (browsers reconnect automatically). The worker gets 45 s: on `SIGTERM` pg-boss stops fetching jobs and waits up to 25 s for running ones; anything cut off is retried after its job expires.

## 7. Operating it

### Scaling

- **Web** is stateless. Raise `replicas` in `.railway/railway.ts`. Each replica holds one extra Postgres connection for `LISTEN`.
- **Worker**: raise `replicas` or `WORKER_CONCURRENCY` (analysis jobs use half of it). pg-boss distributes jobs safely across workers, and the reconcile cron runs once per interval regardless of the worker count.
- **Connections**: each web replica uses up to about 14 (pool 10 + pg-boss 3 + LISTEN 1); each worker up to about 16 (pool 10 + pg-boss 6). Postgres allows 100 by default.
- **Don't put PgBouncer in transaction mode in front of the app.** Live progress needs a session-level `LISTEN` connection, and the job queue uses session features. Connect `DATABASE_URL` directly to Postgres.

### Backups

Enable point-in-time recovery and a backup schedule on the database:

```bash
railway postgres pitr enable --service Postgres
railway postgres pitr schedule set --daily --weekly
railway postgres pitr backup create --service Postgres --name pre-launch
```

Restores create a sibling database service. Point `DATABASE_URL` at it to cut over.

### Logs worth watching

| Prefix | Meaning |
|---|---|
| `[pipeline] … failed permanently` | A report failed with a known code (credit refunded) |
| `[pipeline] … failed, will retry` | A transient error; pg-boss retries |
| `[pipeline] reconcile` | The reconciler repaired stuck reports or reservations |
| `[stripe] invoice payment failed` | A renewal failed; the user was emailed |
| `[realtime] listener error` | The LISTEN connection dropped; it reconnects automatically |
| `[turnstile] verification unavailable` | Cloudflare unreachable; free report creation is refused until it recovers |
| `[turnstile] configuration error` | Cloudflare rejected `TURNSTILE_SECRET_KEY`; every check fails until it's fixed |
| `[email] send failed` | Resend rejected or didn't answer; check the key, sender domain and Resend status |
| `[pipeline] report failed after exhausting retries` | A job kept failing until pg-boss dead-lettered it (credit refunded) |
| `[stripe] no local row for subscription` | A Stripe subscription has no matching row (usually a checkout that didn't finish) |

### What each report costs

Every paid call is recorded in the `report_usage` table: each Claude request (tokens and the model that served it, priced from `src/server/pipeline/costs.ts`) and each delivered Bright Data snapshot (records, priced at `BRIGHTDATA_COST_PER_1K_RECORDS`, counted once even when a retried job downloads it again). Retries and failed reports are included, since they are billed too. The worker also logs `[pipeline] report completed` with `costUsd`. Run these with `railway connect Postgres`:

```sql
-- Cost per report type and plan over the last 30 days
select r.type, r.tier, count(distinct r.id) as reports,
       round(sum(u.cost_micros) / 1e6 / count(distinct r.id), 4) as avg_cost_usd,
       round(sum(u.cost_micros) / 1e6, 2) as total_usd
from report_usage u join report r on r.id = u.report_id
where u.created_at > now() - interval '30 days'
group by r.type, r.tier order by total_usd desc;

-- Where the money goes: provider and task
select provider, task, model, count(*) as calls,
       sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens,
       sum(records) as records, round(sum(cost_micros) / 1e6, 2) as usd
from report_usage where created_at > now() - interval '30 days'
group by 1, 2, 3 order by usd desc nulls last;
```

Prices in `costs.ts` are list prices; update them if Anthropic's pricing changes or you negotiate a discount.

### Rotating secrets

- `BETTER_AUTH_SECRET`: rotating it signs everyone out.
- `WEBHOOK_SIGNING_SECRET`: change it on the web service (the worker references it), then redeploy **both** services. Collections already running lose their webhook; the timeout poller picks them up within 16 minutes.
- Stripe, Resend, Turnstile, Anthropic, Bright Data: rotate in the provider, update the variable, redeploy the service that uses it.

## 8. Local development

```bash
cp .env.example .env.local          # only DATABASE_URL is required
npm install
npm run db:migrate
npm run dev                          # web on http://localhost:3000
npm run dev:worker                   # pipeline worker (fake providers by default)
```

Emails (verification and reset links) print to the web server's console. Fake providers simulate Bright Data and Claude, including webhooks, so the full flow works offline. Put `simulate failure` in a keyword or topic to see the refund path. Set `PROVIDER_MODE=live` with real keys to test against the real APIs.

Tests use a separate database (`aiseo_test`): `npm test`.
