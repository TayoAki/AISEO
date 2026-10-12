# Deploying AISEO on Railway

AISEO runs as three Railway resources built from this one repository:

| Resource | What it runs | Start command |
|---|---|---|
| `postgres` | Postgres (app data, pg-boss job queue, LISTEN/NOTIFY) | managed by Railway |
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

Merge the rebuild into the branch Railway deploys from (`main` in `.railway/railway.ts`; change `SOURCE` there if you deploy another branch or a fork).

## 2. Create the project

```bash
npm install                  # installs the railway IaC SDK (dev dependency)
railway login
railway init                 # or `railway link` to an existing, empty project
railway config plan          # review: 1 database + 2 services
railway config apply
```

The first deploys of `web` and `worker` fail fast with "Invalid web configuration" or "Invalid worker configuration". That's expected: their secrets aren't set yet. Each service lists exactly what is missing in its deploy logs.

## 3. Give the web service a domain

Run `railway domain --service web` (or `railway domain app.yourdomain.com --service web` for a custom domain), or use **web → Settings → Networking** in the dashboard. The resulting `https://…` URL is your `APP_URL`. Use the same domain for the Turnstile widget and the Stripe webhook below.

## 4. Set the secrets

Secrets are declared with `preserve()` in `.railway/railway.ts`, so the file never contains them and `railway config apply` never overwrites them. Set them once per environment, either in the dashboard (**service → Variables**) or with the CLI (`--skip-deploys` avoids a redeploy per command):

```bash
# Both services share the public URL and the webhook signing key.
# Generate the key once: it must be identical on web and worker.
WEBHOOK_SECRET=$(openssl rand -hex 32)
for svc in web worker; do
  railway variable set --service "$svc" --skip-deploys \
    "APP_URL=https://your-domain" "WEBHOOK_SIGNING_SECRET=$WEBHOOK_SECRET"
done

railway variable set --service web --skip-deploys \
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

Each service holds only the secrets it uses. The web service never sees provider keys; the worker never sees auth or Stripe secrets. `DATABASE_URL` is wired to the `postgres` resource by the IaC file. Check what a service has with `railway variable list --service web`.

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

The worker uses `claude-opus-5-5` with `ANTHROPIC_EFFORT=medium` and Claude's server-side refusal fallback (`ANTHROPIC_REFUSAL_FALLBACK=true`). To lower the cost per report, set `ANTHROPIC_MODEL=claude-sonnet-5-5` in `.railway/railway.ts` (or on the worker's variables) and redeploy.

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
railway postgres pitr enable --service postgres
railway postgres pitr schedule set --daily --weekly
railway postgres pitr backup create --service postgres --name pre-launch
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

### Rotating secrets

- `BETTER_AUTH_SECRET`: rotating it signs everyone out.
- `WEBHOOK_SIGNING_SECRET`: update **both** services. Collections already running lose their webhook; the timeout poller picks them up within 16 minutes.
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
