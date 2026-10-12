# Subscriptions, Race-Free Usage Quotas, Server-Side Entitlements and Free-Tier Abuse Prevention for a Small AI SaaS (RankSEO), as of October 2026

Research date: 2026-10-12. Dating convention: "(acc. 2026-10-12)" = undated doc or pricing page, read on that date. Explicit publication dates are given where the source has one. Anything dated before about Oct 2025 is marked **[>12 mo, possibly stale]**. "Vendor claim" = the vendor's own marketing or a competitor's page, not independently verified.

RankSEO context these notes are written against: Free = 2 lifetime keyword searches + 2 lifetime visibility scans. Pro = 100 + 25 per month. Plus = 500 + 100 per month. Monthly and annual prices. Each report costs real money (Bright Data + Claude). Current build: Better Auth Stripe plugin, a racy count-then-create quota check, failed reports counted against quota, paid sections hidden only in the UI, and no email verification, CAPTCHA or rate limiting.

---

## 1. Options and trade-offs: Better Auth Stripe plugin vs hand-rolled Stripe Billing vs billing/entitlement layers (Autumn, Polar, Lago, Flexprice, OpenMeter; Metronome/Orb for context). Which ones model "N reports per month + lifetime free credits" and enforce it atomically?

### Takeaway
None of the payment rails count and enforce quotas atomically. That covers the Better Auth Stripe plugin's `limits`, Stripe Entitlements (feature on/off only), Stripe Billing Meters (billing-side metering) and Polar meter credits ("Polar doesn't block usage"). Of the layers researched, only Autumn documents an atomic check-and-hold (balance locks with confirm/release), monthly resets on annual plans, and balances that never reset. For a solo developer the most manageable setup is to keep a Better Auth payment plugin for subscription state and enforce quotas in your own Postgres. That takes about 2 tables and 3 SQL statements (section 2). Autumn is the credible buy-instead-of-build option if you accept three costs: a network hop on every check, a fail-open default, and a jump from $0 to $375/mo above $8K monthly billing volume.

### Cited Findings

**Better Auth Stripe plugin (Better Auth docs v1.7 current; acc. 2026-10-12)**
- Plan config supports `name`, `priceId` or `lookupKey`, `annualDiscountPriceId`/`annualDiscountLookupKey` (annual price), `limits` (e.g. `{ projects: 10, storage: 5 }`), `group`, `lineItems`, `freeTrial`, and `seatPriceId` (needs the organization plugin). — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- The plugin handles `checkout.session.completed` and `customer.subscription.created|updated|deleted`, with built-in signature verification. Any other Stripe event reaches you through `onEvent`. — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- It provides a billing portal (`POST /subscription/billing-portal`), cancel (redirects to the Stripe portal), restore, and `scheduleAtPeriodEnd` plan changes via Stripe Subscription Schedules. — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- Trial abuse prevention is automatic: "a user gets one trial across all plans", judged from prior `trialStart`/`trialEnd` or `trialing` status, and it cannot be overridden. — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- "Only one active or trialing subscription per reference ID is supported." — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- The docs never mention usage-based or metered billing, quota enforcement or entitlements. `limits` is plain configuration that your app reads and enforces itself (e.g. `subscriptions?.limits?.projects`). — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- The docs pin `stripe@^22.0.0` and use API version `"2026-06-24.dahlia"` in examples, so the plugin tracks current Stripe API versions. — [Better Auth Stripe plugin docs](https://www.better-auth.com/docs/plugins/stripe)
- The `subscription` table on `main` (acc. 2026-10-12) has these fields: `plan`, `referenceId`, `stripeCustomerId`, `stripeSubscriptionId`, `status` (default `"incomplete"`), `periodStart`, `periodEnd`, `trialStart`, `trialEnd`, `cancelAtPeriodEnd`, `cancelAt`, `canceledAt`, `endedAt`, `seats`, `billingInterval`, `stripeScheduleId`. There is no usage or counter table. — [better-auth/packages/stripe/src/schema.ts](https://raw.githubusercontent.com/better-auth/better-auth/main/packages/stripe/src/schema.ts)

**Hand-rolled Stripe Billing (Checkout, Customer Portal, webhooks, Entitlements, Meters)**
- Stripe Billing pay-as-you-go costs 0.7% of Billing volume, counting transactions on and off Stripe but not one-off invoices. Monthly plans start at $620/mo on a 1-year contract. — [Stripe Billing pricing](https://stripe.com/billing/pricing) (acc. 2026-10-12)
- Billing includes recurring billing, Smart Retries, up to three recovery automations, the Customer portal (a custom domain is $10/month), quotes and multiphase subscription schedules. — [Stripe Billing pricing](https://stripe.com/billing/pricing) (acc. 2026-10-12)
- Basic usage-based billing through the Meters API is included in Billing pricing up to 100M events/month. Stripe's pricing page now lists advanced "Usage-based billing" as a **Metronome** product, priced by contacting Metronome. — [Stripe Billing pricing](https://stripe.com/billing/pricing) (acc. 2026-10-12)
- How Stripe Entitlements works:
  - You create Features (`lookup_key`) and attach them to Products. Stripe maintains Active Entitlements per customer and fires `entitlements.active_entitlement_summary.updated` when they change.
  - The documented `active_entitlement` object carries only `id`, `feature`, `lookup_key` and `livemode`, with no quantity or limit. It models feature access only, not counts.
  - The summary webhook carries at most 10 entitlements.
  - "Existing subscriptions will create active entitlements for any product feature changes at the start of the next billing period."
  - Stripe recommends: "persist these entitlements internally for faster resolution."
  - Source: [Stripe Entitlements (API)](https://docs.stripe.com/billing/entitlements?dashboard-or-api=api) (acc. 2026-10-12)
- Stripe webhooks: endpoints "might occasionally receive the same event more than once", so log event IDs. Stripe "doesn't guarantee the delivery of events in the order that they're generated". Live-mode retries run for up to three days with exponential backoff. Return 2xx before doing complex logic, and verify signatures against the raw body. New event destinations offer "Thin (recommended)" or "Snapshot" payloads. — [Stripe webhooks docs](https://docs.stripe.com/webhooks) (acc. 2026-10-12)
- From API version `2025-03-31.basil`, `current_period_start` and `current_period_end` were removed from the Subscription object and moved to subscription items. This is a breaking change. — [Stripe changelog](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end) **[>12 mo, but a structural change still in effect]**

**Autumn (useautumn)**
- An open-source (Apache-2.0) "pricing and billing layer that sits between Stripe and your app". Core APIs are `/attach` (checkout and upgrades), `/check` (access and remaining usage) and `/track` (record usage). Self-hosting runs on `bun` but "depends on several services". About 2.8k GitHub stars. — [GitHub useautumn/autumn](https://github.com/useautumn/autumn) (acc. 2026-10-12)
- Pricing: **Free $0** up to 8K monthly billing volume, 10,000 customers, 10M API requests, CLI and MCP. **Pro $375/mo** up to 50K monthly billing volume and 20M requests, then $5 per 1M. Scale is custom. "Stripe fees (0.7% and 2.9% + 30¢) still apply." — [Autumn pricing](https://useautumn.com/pricing) (acc. 2026-10-12; page undated)
- Billing interval and reset interval are configured separately. The docs' own example is a plan billed "$200/year that grants 100 messages every month". Price intervals are `week`, `month`, `quarter`, `semi_annual` and `year`. Upgrades are prorated and downgrades are scheduled for period end. — [Autumn recurring plans](https://docs.useautumn.com/documentation/modelling-pricing/recurring) (acc. 2026-10-12)
- With `interval: "one_off"`, balances "never reset or expire". One-off balances stack with recurring ones, and the deduction order consumes shorter-interval (monthly) balances before one-off (lifetime) balances. — [Autumn one-off purchases](https://docs.useautumn.com/documentation/modelling-pricing/one-off-purchases) (acc. 2026-10-12)
- **Balance locking (reserve, then commit or refund):**
  - Call `check` with `lock: { enabled, lock_id, expires_at }`. It verifies and holds the balance "in a single call", and the held balance cannot be consumed by another concurrent request.
  - Then call `balances.finalize` with `action: "confirm"` (deduct), `"release"` (refund, e.g. on failure), or an override value for the actual usage.
  - `expires_at` can be at most 24h out, and the hold is released automatically when it expires.
  - For fast, known-cost operations the docs recommend `check` with `sendEvent`, which "deducts immediately".
  - Source: [Autumn balance locking](https://docs.useautumn.com/documentation/customers/balance-locking) (acc. 2026-10-12)
- **Fail-open by default:**
  - On 5xx errors, network failures or timeouts, `check()` returns `{ allowed: true }` and `track()` returns `{ value: 0, balance: null }`, which means "the usage event is silently dropped".
  - `failOpen: false` exists in the TypeScript SDK `@useautumn/sdk`.
  - The framework SDK `autumn-js` (the one used by the Better Auth plugin) lists fail-open support as "Coming soon".
  - Source: [Autumn fail-open defaults](https://docs.useautumn.com/documentation/fail-open) (acc. 2026-10-12)
- The Better Auth plugin is `autumn-js/better-auth`. It auto-creates an Autumn customer at sign-up and assigns any default (e.g. free) plan. Server calls are `auth.api.check` and `auth.api.track`. `customerScope` can be `"organization"` or `"user_and_organization"`. "No webhooks to set up." — [Better Auth Autumn plugin](https://better-auth.com/docs/plugins/autumn.md) (acc. 2026-10-12)
- Autumn's own comparison says Stripe alone may be enough unless you need rollovers, monthly vs lifetime balances, or product-level usage limits. — [Autumn vs Stripe Billing](https://useautumn.com/alog/autumn-vs-stripe-billing) (vendor claim; acc. 2026-10-12)

**Polar (MoR with usage billing)**
- Meter Credits benefit: subscription products credit units "at the beginning of every subscription cycle period", monthly or yearly. One-time products credit them once. "Polar doesn't block usage if the customer exceeds their balance", so enforcement is up to your app. — [Polar credits docs](https://polar.sh/docs/features/usage-based-billing/credits) (acc. 2026-10-12)
- The Better Auth plugin `@polar-sh/better-auth` provides:
  - checkout and customer portal
  - `usage.ingest()` and `usage.meters.list()`
  - `customer.state()`, which returns subscriptions, benefits and meter balances
  - webhooks at `/polar/webhooks`
  - `createCustomerOnSignUp`, which uses the user ID as `externalId`
  - The docs describe no enforcement.
  - Source: [Better Auth Polar plugin](https://better-auth.com/docs/plugins/polar.md) (acc. 2026-10-12)

**Dodo Payments (MoR)**
- The Better Auth plugin `@dodopayments/better-auth` handles customer creation on sign-up, checkout by product slug, the customer portal and verified webhooks. Its feature list does not mention credits or entitlements. Dodo's agent plugin includes a "credit-based billing" skill (entitlements, balances, rollover, meter-based deduction). — [Better Auth Dodo plugin](https://better-auth.com/docs/plugins/dodopayments), [Dodo "build with AI coding agents"](https://docs.dodopayments.com/developer-resources/build-with-ai-coding-agents) (from search summaries; acc. 2026-10-12)

**Lago, Flexprice, OpenMeter**
- **OpenMeter:** Kong announced the acquisition on **Sep 3, 2025** and said OpenMeter would be folded into Kong Konnect for "usage-based pricing, entitlements, and invoicing". — [Kong press release](https://konghq.com/company/press-room/press-release/kong-acquires-openmeter-to-unlock-ai-and-api-monetization-for-the-agentic-era), [SiliconANGLE](https://siliconangle.com/2025/09/03/kong-acquires-openmeter-power-api-ai-monetization/) **[>12 mo, possibly stale]**. A third-party timeline says the managed product is now "Kong Metering & Billing" and the Apache-2.0 open-source edition continues. — [usagepricing.com](https://usagepricing.com/blueprint/activity/openmeter-2025-09-03-kong-acquisition) (unverified)
- **Flexprice:**
  - AGPL-3.0 core.
  - Claims entitlements and credit wallets ship in the open-source tier, with grants, per-grant expiry, rollover, deduction order and auto top-up.
  - Managed cloud is claimed free up to 100K events/mo, $500 at 1M and $1,000 at 5M.
  - Source: [Flexprice blog](https://flexprice.io/blog/open-source-alternatives-for-usage-based-billing) (vendor claim; acc. 2026-10-12)
- **Lago:** AGPLv3, either self-hosted or on Lago Cloud, and lists entitlements as a capability. — [getlago.com](https://getlago.com/index.md) (vendor; acc. 2026-10-12). A competitor (Flexprice) says Lago's pricing page, checked 26 Aug 2026, puts entitlements, prepaid credits, the customer portal and the MCP server in Premium. — [Flexprice glossary](https://flexprice.io/glossary/open-source-billing) (competitor claim, unverified). A third-party guide gives the latest release as v1.50.0 (2026-07-07) with about 10.2k stars (unverified, via search).

**Enterprise context (Metronome, Orb)**
- Stripe signed a definitive agreement to buy Metronome, announced Dec 2, 2025, at a reported ~$1B. Stripe's newsroom says the acquisition is complete. One analysis dates the close to Jan 14, 2026 (unverified). — [PYMNTS](https://www.pymnts.com/acquisitions/2025/stripe-acquires-metronome-to-enhance-metered-pricing-capabilities-for-ai-companies), [Stripe newsroom](https://stripe.com/newsroom/news/stripe-completes-metronome-acquisition)
- Stripe's Billing pricing page now routes advanced usage-based billing to Metronome ("contact Metronome for pricing"). — [Stripe Billing pricing](https://stripe.com/billing/pricing) (acc. 2026-10-12)

### Inferences
- **How each option fits RankSEO's model** (2 lifetime free scans per feature; 100/25 or 500/100 per month; monthly and annual prices):
  - **Better Auth Stripe plugin:** good for subscription state. It stores `plan`, `status`, `periodStart`/`periodEnd` and `billingInterval` in your own Postgres. It has no counters, so you add a quota table (section 2). This is the smallest change from today's build.
  - **Stripe Entitlements:** usable for boolean gates such as "can see paid report sections", but not for counts. Stripe itself recommends mirroring it locally, which duplicates what the Better Auth `subscription` row already gives you. It adds little for RankSEO.
  - **Stripe Billing Meters:** these exist to bill usage after the fact. RankSEO sells fixed allowances with no overage, so meters do not help enforcement.
  - **Autumn:** the only researched layer that models monthly resets on annual plans, lifetime balances and atomic reserve/confirm/release natively. The costs:
    - every report submission depends on an external API
    - fail-open by default, which is dangerous when each report costs real money
    - for the `autumn-js` SDK that the Better Auth plugin uses, the docs list fail-open support as "Coming soon", so its outage behaviour and whether `failOpen: false` can be set there are unclear; test it before relying on it
    - $375/mo once monthly billing volume passes $8K
  - **Polar / Dodo meters and credits:** both shift enforcement back to your code. Polar grants credits per *subscription cycle*, so an annual plan gets one grant a year, not 100 per month. Either way you still need your own counter.
  - **Lago / Flexprice / OpenMeter (Kong):** self-hosting adds a separate billing system (AGPL for Lago and Flexprice) to run. That is too much for 3 plans × 2 features.
- **Recommendation for a solo developer:** keep the Better Auth Stripe plugin (or swap to its Polar or Dodo sibling if you choose an MoR, see section 5). Model quotas in your own Postgres with a reserve/commit/release pattern. Revisit Autumn only if pricing becomes more complex (top-ups, rollovers, per-seat credits).
- If Autumn is adopted anyway, use `failOpen: false` via `@useautumn/sdk` on the report-creation path. Treat Autumn outages as "temporarily unavailable" rather than "free reports".

### Gaps
- Autumn does not document a **free plan with a lifetime (non-resetting) allowance**. The one-off page covers *paid* lifetime plans, so whether a free default plan can carry `one_off` balances is unverified.
- Autumn does not say whether `check` with `sendEvent` (no lock) is atomic under concurrency. Only the lock path is documented as atomic.
- Autumn's check latency, SLA and status history were not found.
- Orb was not researched (context only).
- OpenMeter/Kong entitlement semantics (grants, usage periods) were not read from primary docs.
- Lago's current tiering is unverified (the only source is a competitor).
- The Stripe Billing Meters docs were not fetched; the 100M events/month figure comes from the pricing page.

---

## 2. Race-free quota patterns on Postgres: conditional UPDATE ... RETURNING, SELECT ... FOR UPDATE, credit ledgers, reserve-then-commit with refunds, idempotency keys, calendar vs billing-period resets, and Redis as an alternative

### Takeaway
Postgres's default READ COMMITTED isolation makes a single-statement conditional `UPDATE ... WHERE used + reserved < quota RETURNING` race-free. A concurrent updater waits, then re-checks the `WHERE` against the new row version. Pair it with three things:
- a reservation that is committed on success and released on failure, so failed reports never count
- a unique idempotency key on report creation (`INSERT ... ON CONFLICT DO NOTHING RETURNING`)
- monthly windows anchored to the subscription start (works for both monthly and annual plans), plus a separate never-resetting "free lifetime" bucket

Redis INCR is atomic but belongs in rate limiting, not in money-backed quotas that must commit in the same transaction as the report row.

### Cited Findings
- PostgreSQL 18 docs (18.6 is "current" as of 2026-10-12), Read Committed: `UPDATE`, `DELETE`, `SELECT FOR UPDATE` "will only find target rows that were committed as of the command start time". If a target row was concurrently updated, "the would-be updater will wait for the first updating transaction to commit or roll back… The search condition of the command (the WHERE clause) is re-evaluated to see if the updated version of the row still matches." — [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- Under Repeatable Read and Serializable, "applications… must be prepared to retry transactions due to serialization failures" (SQLSTATE `40001`). — [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- "`ON CONFLICT DO UPDATE` guarantees an atomic INSERT or UPDATE outcome… even under high concurrency". `ON CONFLICT DO NOTHING` "simply avoids inserting a row". `RETURNING` returns "only rows that were successfully inserted or updated". — [PostgreSQL: INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- Stripe idempotency keys (as a reference design):
  - Keys are client-generated, ideally "V4 UUIDs", up to 255 characters.
  - In API v1 the server saves the first response, including 500s, and replays it.
  - Keys can be pruned after at least 24 hours.
  - The server compares incoming parameters with the original request and errors on mismatch.
  - Source: [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests) (acc. 2026-10-12)
- Stripe webhooks: track event IDs to dedupe, and don't use the `created` timestamp for ordering ("distinct events can share a timestamp"). — [Stripe webhooks](https://docs.stripe.com/webhooks) (acc. 2026-10-12)
- Autumn's managed version of reserve-then-commit: lock and hold atomically, then `confirm`, `release` or adjust. Locks expire after at most 24h and release automatically. — [Autumn balance locking](https://docs.useautumn.com/documentation/customers/balance-locking) (acc. 2026-10-12)
- Autumn resets balances "at the start of each period". In its sample customer, a monthly balance's `nextResetAt` equals the subscription's `currentPeriodEnd`, which suggests billing-anchor resets, but the docs don't say calendar vs anchor explicitly. — [Autumn recurring plans](https://docs.useautumn.com/documentation/modelling-pricing/recurring) (acc. 2026-10-12)
- Autumn's deduction order consumes shorter-interval (monthly) balances before one-off (lifetime) ones. — [Autumn one-off purchases](https://docs.useautumn.com/documentation/modelling-pricing/one-off-purchases) (acc. 2026-10-12)
- Polar grants subscription credits at the start of each subscription cycle, monthly or yearly. — [Polar credits](https://polar.sh/docs/features/usage-based-billing/credits) (acc. 2026-10-12)
- Stripe billing periods now live on subscription items (`items.data[].current_period_start/end`). `customer.subscription.updated` `previous_attributes` reflect item-level period changes. — [Stripe changelog (basil)](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end) **[>12 mo; structural]**
- Better Auth's `subscription` row stores `periodStart`, `periodEnd` and `billingInterval`. — [Better Auth Stripe schema.ts](https://raw.githubusercontent.com/better-auth/better-auth/main/packages/stripe/src/schema.ts) (acc. 2026-10-12)
- Redis `INCR` is atomic and O(1). The "INCR then EXPIRE" rate-limiter variant has a documented race (the key can leak), fixed with `MULTI/EXEC` or a Lua script. — [Redis INCR docs](https://redis.io/docs/latest/commands/incr/) (acc. 2026-10-12)
- Better Auth's custom rate-limit storage (`customStorage.consume`) "must check and increment atomically". Memory storage is the default and "may not suit serverless". `storage: "database"` and `"secondary-storage"` are the alternatives. — [Better Auth rate limit](https://better-auth.com/docs/concepts/rate-limit.md) (acc. 2026-10-12)
- InsForge's payments docs name an app-owned `public.credit_ledger` table as the pattern for credits. It is not a built-in feature. — [InsForge payments overview](https://docs.insforge.dev/core-concepts/payments/overview) (acc. 2026-10-12)

### Inferences
**Pattern A, the minimal fix to today's count-then-create** (keeps counting report rows):
```sql
BEGIN;  -- READ COMMITTED (Postgres default)
SELECT 1 FROM "user" WHERE id = $uid FOR UPDATE;          -- serialize per user
SELECT count(*) FROM report
 WHERE user_id = $uid AND kind = $kind
   AND status IN ('pending','running','succeeded')          -- failed/cancelled don't count
   AND created_at >= $window_start AND created_at < $window_end;   -- omit window for free lifetime
-- if count >= quota -> ROLLBACK, return 402
INSERT INTO report (id, user_id, kind, status, idempotency_key) VALUES (...)
  ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id;
COMMIT;
```
- Under READ COMMITTED each statement gets a fresh snapshot. Once the second request obtains the row lock, its `count(*)` therefore sees the first request's committed insert. This relies on the per-command snapshot semantics quoted above. Do **not** run this at REPEATABLE READ: the snapshot would be stale, and you would get serialization errors to retry.
- Pros: a tiny diff, and "refunds" happen automatically because failed rows are excluded.
- Cons: a count query on every submit, and no place to record manual grants or top-ups.

**Pattern B, counter per window with reserve, commit and release** (recommended):
```sql
CREATE TABLE quota_bucket (
  user_id text, feature text,                 -- 'keyword_search' | 'visibility_scan'
  window_start timestamptz, window_end timestamptz,  -- '-infinity'/'infinity' = free lifetime bucket
  quota int NOT NULL, used int NOT NULL DEFAULT 0, reserved int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feature, window_start),
  CHECK (used + reserved <= quota)            -- belt-and-braces
);
-- 0) lazily create the current window (no cron needed):
INSERT INTO quota_bucket (...) VALUES ($uid,$f,$ws,$we,$quota_for_plan) ON CONFLICT DO NOTHING;
-- 1) reserve, single statement, race-free:
UPDATE quota_bucket SET reserved = reserved + 1
 WHERE user_id=$uid AND feature=$f AND window_start=$ws AND used + reserved < quota
RETURNING quota - used - reserved AS remaining;    -- 0 rows => 402 quota exceeded
-- 2) same transaction: INSERT report ... ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id
--    0 rows => duplicate submit: ROLLBACK (undoes the reservation) and return the existing report
-- 3a) worker success:  UPDATE ... SET reserved = reserved - 1, used = used + 1
-- 3b) worker failure:  UPDATE ... SET reserved = reserved - 1        -- failed reports never count
```
- Make commit and release idempotent too, because workers retry. Keep a `reservation(report_id PK, state, expires_at)` row and adjust the counters only when `UPDATE reservation SET state='committed' WHERE report_id=$1 AND state='held' RETURNING 1` returns a row.
- Run a sweeper (app cron or pg_cron) that releases reservations whose `expires_at` has passed, for crashed jobs. This mirrors Autumn's lock TTL.
- Never hold a database transaction open for the whole Bright Data + Claude job. Reserve in a short transaction, then run the job asynchronously.

**Pattern C, append-only credit ledger** (if top-ups, admin grants, promos or audit trails are on the roadmap):
- Rows look like `credit_ledger(user_id, feature, bucket, delta, kind ∈ {grant, debit, refund, expire}, report_id, idempotency_key UNIQUE)`.
- Pair it with a materialized balance row locked with `SELECT ... FOR UPDATE`, or apply the same conditional UPDATE to the balance row.
- It costs more code than Pattern B but answers "why do I have 3 scans left?" and makes refunds explicit.

**Windows and resets**
- **Free:** one bucket per feature with `window = (-infinity, infinity)` and quota 2. It is never reset.
- **Paid, monthly plans:** take the window from the subscription period. With the Better Auth plugin, use `periodStart`/`periodEnd`. If you read Stripe directly, use item-level `current_period_*` (basil+).
- **Paid, annual plans:** the billing period is one year, so derive monthly sub-windows from the subscription anchor, `[anchor + k months, anchor + (k+1) months)`, with quota 100/25 (Pro) or 500/100 (Plus). This is the same "bill yearly, reset monthly" model Autumn supports natively. A calendar month (`date_trunc('month', now())`) is simpler, but it gives someone who subscribes on the 28th a 3-day first month, so use anchored windows or prorate the first window.
- **Plan changes:** on upgrade, raise `quota` on the current window row and keep `used`. On downgrade, apply the new quota at the next window. Both are product decisions; both are cheap with Pattern B.
- **Deduction order** for paid users who still have free lifetime credits: consume the monthly bucket first, then the lifetime bucket (as Autumn does), or simply ignore the free bucket once a user is paid.

**Redis**
- Use it for per-IP and per-user request rate limits and for short-lived concurrency caps (e.g. at most 1 running report per free user).
- Do not use it for the paid allowance. It cannot commit atomically with the `report` insert in Postgres, and on Railway it is another service to run.
- Better Auth's limiter can already use `storage: "database"`, which avoids Redis entirely at RankSEO's scale.

**How this fixes the current build's quota problems**
- The racy count-then-create becomes Pattern A or B.
- "Failed reports count" is fixed by release-on-failure (B) or by excluding failed statuses (A).
- Double submits are fixed by the idempotency key.

### Gaps
- No independent engineering blog from 2025–2026 on credit ledgers or reserve-commit was fetched. The patterns are grounded in Postgres and Stripe docs plus Autumn's API design.
- Exact Autumn reset anchoring (calendar vs billing anchor) is not stated in its docs.
- pg_cron availability on Railway Postgres and on InsForge (which mentions pg_cron for schedules) was not checked for this topic.

---

## 3. Server-side entitlement enforcement: gating paid fields in API responses

### Takeaway
Paid sections must never leave the server for non-entitled users. Resolve entitlements server-side from your own mirrored subscription state, then build responses with an explicit per-tier allowlist serializer. OWASP API3:2023 names this exact failure mode. On BaaS stacks where the client queries tables directly (Supabase or InsForge PostgREST-style), RLS is row-level only. Put paid content in separate rows or tables gated by RLS, or serve it only through a server function, rather than relying on column privileges.

### Cited Findings
- OWASP API3:2023 (Broken Object Property Level Authorization): "APIs tend to expose endpoints that return all object's properties". An endpoint is vulnerable if it "exposes properties of an object that are considered sensitive and should not be read by the user". The prevention guidance:
  - "Avoid using generic methods such as `to_json()` and `to_string()`"
  - "cherry-pick specific object properties you specifically want to return"
  - "Implement a schema-based response validation mechanism as an extra layer of security"
  - Source: [OWASP API3:2023](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization) (2023 edition; still the current OWASP API Top 10 as far as found)
- Stripe recommends persisting entitlements internally and using List Active Entitlements for reconciliation "after a webhook delivery failure". — [Stripe Entitlements (API)](https://docs.stripe.com/billing/entitlements?dashboard-or-api=api) (acc. 2026-10-12)
- Supabase says RLS "doesn't give you control over which columns they can access within rows". Column privileges break `select *` ("All operations… as well as using `select *` will fail"), and Supabase says: "We do not recommend using column-level privileges for most users", recommending "RLS policies in combination with a dedicated table" instead. — [Supabase column-level security](https://supabase.com/docs/guides/database/postgres/column-level-security) (acc. 2026-10-12)
- InsForge's recommended entitlement pattern:
  - Keep app-owned tables (e.g. `public.team_entitlements`), populated by an idempotent trigger (`fulfill_from_payment_webhook`) from verified rows in `payments.webhook_events`.
  - Protect them with your own RLS plus server-side membership checks.
  - "Don't fulfill orders from success URLs or checkout callbacks alone."
  - "Providers give no ordering guarantee across events."
  - Source: [InsForge payments overview](https://docs.insforge.dev/core-concepts/payments/overview) (acc. 2026-10-12)
- InsForge mirrors subscription rows into Postgres "so feature gating and entitlements are a SELECT, not a Stripe API round-trip". — [InsForge docs/blog via search](https://insforge.dev/blog/insforge-payments) (blog dated May 6, 2026)
- The Better Auth Autumn plugin's example calls `check` on the backend before processing. The client-side `allowed()` is only used to update the UI. — [Better Auth Autumn plugin](https://better-auth.com/docs/plugins/autumn.md) (acc. 2026-10-12)
- Polar's `customer.state()` is "the required information to check if you should provision access". — [Better Auth Polar plugin](https://better-auth.com/docs/plugins/polar.md) (acc. 2026-10-12)

### Inferences
- **The pattern:**
  1. Write `getEntitlements(userId)`, which reads the Better Auth `subscription` row (status in `active`/`trialing`, plan, periods) and returns e.g. `{ tier: 'free'|'pro'|'plus', sections: Set<'competitors'|'recommendations'|...> }`.
  2. Write `serializeReport(report, entitlements)`, which builds the DTO from an explicit allowlist per tier. Locked sections become `{ locked: true, teaser? }` with no payload.
  3. Validate the response schema in tests, e.g. a contract test asserting that a free-tier JSON body contains none of the paid keys.
- **Cheaper still:** don't *generate* paid sections for free users. Skip the extra Bright Data and Claude calls entirely, which also cuts cost per free report. Store sections per row (`report_section(report_id, section, min_tier, payload)`) so that gating becomes a row filter that works in both app code and RLS.
- **SSR frameworks (e.g. Next.js server components):** filter before data crosses into client components or props. Anything serialized into the page payload is "sent to the client" even if it isn't rendered. This is the UI-only gating bug RankSEO has today.
- **Upgrades:** entitlement changes arrive by webhook, out of order and possibly duplicated. Recompute from the stored subscription state on each request (one indexed SELECT) instead of caching tier in the session cookie or JWT. A stale JWT claim would keep paid access after cancellation, or deny it after an upgrade.
- **On Supabase or InsForge:** if the frontend reads tables directly, put paid sections in a separate table with an RLS policy that joins to the entitlements table, or expose reports only through an RPC or edge function. Avoid column privileges, per Supabase's own advice.

### Gaps
- No 2025–2026 engineering blog specifically on "paywalled JSON fields" was fetched. The guidance rests on OWASP plus vendor docs.
- How InsForge's RLS performs with join-based entitlement policies was not researched.

---

## 4. Free-tier abuse prevention for AI SaaS in 2026: email verification, Turnstile/CAPTCHA, disposable-email blocking, per-IP/device limits, phone verification, card-on-file

### Takeaway
Multi-account abuse of AI free tiers is measurably rising. Stripe reports a 40% increase in attempted multi-account abuse at AI subscription companies from Jan to Jun 2026, and 7.4% of AI sign-ups implicated. The 2026 baseline for a cheap, low-friction setup is:
- Cloudflare Turnstile (free) on sign-up **and** on report creation
- required email verification
- disposable-domain blocking plus email normalization
- per-IP and per-device sign-up velocity limits
- free credits granted only after these pass, and keyed to device/IP as well as to the account

Phone verification (Twilio ~$0.058 per US verification) and card-on-file are the high-friction backstops. Stripe Radar's new Account Evaluations API scores sign-ups for multi-accounting **before** any payment, but it needs Radar Pro in live mode.

### Cited Findings
**Threat data**
- Stripe (Mar 10, 2026):
  - "a significant increase in abusive free trials across Stripe's network" between Nov 2025 and Feb 2026
  - "7.4% of customer sign-ups at AI companies are implicated in suspected multi-account abuse"
  - AI startups with self-serve free trials and direct API access see "10x more attempted abuse than enterprise AI solutions"
  - Source: [Stripe blog: first-party fraud trends](https://stripe.com/blog/analyzing-first-party-fraud-trends-account-free-trial-and-refund-abuse)
- Stripe (Sep 15, 2026):
  - "a 40% increase in attempted multi-account abuse" at AI subscription companies, Jan–Jun 2026
  - the most-affected companies saw +154%, "some seeing over 600% increases"
  - Radar's multi-account abuse prevention helped ElevenLabs "block 2,000 users a day from abusing its free tier"
  - Source: [Stripe blog: fraud at AI startups](https://stripe.com/blog/what-stripe-data-shows-about-fraud-at-ai-startups)
- **Conflicting figures:** third-party guides relay "6.2x more abusive free trials" and "1 in 6 sign-ups" as Stripe data. Neither figure appears in the Stripe primary posts fetched, which say "significant increase" and 7.4%. — [UserCheck guide](https://www.usercheck.com/guides/how-to-prevent-free-trial-abuse) (vendor) vs [Stripe Mar 2026](https://stripe.com/blog/analyzing-first-party-fraud-trends-account-free-trial-and-refund-abuse)
- Vendor guides report that abusers move from Gmail and Outlook to disposable inboxes and temporary SMS numbers. They recommend "progressive friction" (blanket blocking of disposable domains or datacenter IPs catches developers and VPN users) and multi-signal detection ("No one signal decides anything"). — [UserCheck guide](https://www.usercheck.com/guides/how-to-prevent-free-trial-abuse), [Castle blog](https://blog.castle.io/how-bots-and-fraudsters-exploit-free-tiers-in-ai-saas/) (vendor content; acc. 2026-10-12)

**Stripe Radar Account Evaluations (pre-payment sign-up scoring)**
- The `POST /v2/signals/account_evaluations` API (examples use `Stripe-Version: 2026-09-30.preview`) returns `user_multi_accounting` at registration and `user_account_sharing` at login. Highlights:
  - "No payment collection required."
  - Synchronous score 0–100 with `risk_level` bands: `highest` 75–100, `elevated` 65–74, `normal` 0–64.
  - Abuse reasons: email reuse, IP reuse or device-fingerprint reuse within 7 days, and disposable email.
  - Device data comes from a Stripe.js Radar Session, or an IP/user-agent fallback.
  - You report outcomes as `allowed` / `restricted` / `blocked`, where "restricted" means e.g. "fewer promotional credits, … probationary tier".
  - **Live mode requires Radar Pro or a Radar Pro trial.**
  - Source: [Stripe: Customer account evaluations](https://docs.stripe.com/radar/multi-account-and-account-sharing-abuse) (acc. 2026-10-12)
- Stripe's public pricing lists Radar at "starting at $10.00 per month, or pay as you go starting at $0.05 per screened transaction". Radar Pro pricing is not shown. — [Stripe pricing](https://stripe.com/pricing) (acc. 2026-10-12)

**Better Auth built-ins (stack a)**
- The Captcha plugin supports Google reCAPTCHA, **Cloudflare Turnstile**, hCaptcha, CaptchaFox and Vercel BotID. It protects sign-up, sign-in and `/request-password-reset` by default (`endpoints` overrides this). The token goes in header `x-captcha-response`. — [Better Auth Captcha](https://better-auth.com/docs/plugins/captcha.md) (acc. 2026-10-12)
- Rate limiting:
  - Defaults in production are 100 requests per 10 seconds, with `/sign-in/email` at 3 per 10 seconds. It is off in development.
  - There is no built-in sign-up rule, so configure one.
  - Client IP comes from `x-forwarded-for` by default. `ipAddressHeaders` (e.g. `cf-connecting-ip`) and `trustedProxies` are available. "The origin must be reachable only through trusted proxies… Otherwise clients can spoof their IP." IPv6 is limited per /64.
  - Server-side `auth.api` calls are exempt.
  - Source: [Better Auth rate limit](https://better-auth.com/docs/concepts/rate-limit.md) (acc. 2026-10-12)
- `emailAndPassword.requireEmailVerification` rejects sign-in by unverified email/password users with a 403. `sendOnSignUp` sends the verification email. Social logins with unverified provider emails are not blocked. — [Better Auth email](https://better-auth.com/docs/concepts/email.md) (acc. 2026-10-12)
- Sentinel (Better Auth Infrastructure, needs an API key and calls `dash.better-auth.com` / `kv.better-auth.com`) provides:
  - `botBlocking` and `suspiciousIpBlocking`
  - `emailValidation` (`strictness` low/medium/high, MX check, `domainAllowlist`)
  - `emailNormalization`
  - `freeTrialAbuse` with `maxAccountsPerVisitor`, based on a visitor fingerprint sent in the `X-Visitor-Id` header
  - `velocity` (sign-up, sign-in and reset limits)
  - `credentialStuffing` (proof-of-work challenge)
  - `compromisedPassword` (HIBP)
  - `geoBlocking`
  - Each feature can `log`, `challenge` or `block`.
  - Source: [Better Auth Sentinel](https://better-auth.com/docs/infrastructure/plugins/sentinel.md) (acc. 2026-10-12)
- Better Auth Infrastructure pricing: Starter $10/mo (1 seat, 1-day audit logs). **Pro $49/mo + usage**, which includes "security detection", transactional email/SMS and 7-day logs. Scale $299/mo + usage. Enterprise is custom. — [landing.better-auth.com/pricing](https://landing.better-auth.com/pricing) (via search summary; acc. 2026-10-12). This conflicts with the structure shown on [better-auth.com/products](https://better-auth.com/products), so confirm before relying on it.
- The Stripe plugin's trial-abuse protection is per **user** (one trial across all plans). — [Better Auth Stripe plugin](https://www.better-auth.com/docs/plugins/stripe)

**Supabase / InsForge built-ins (stack b)**
- Supabase Auth supports **hCaptcha and Cloudflare Turnstile** on sign-in, sign-up and password-reset flows, configured under Auth → "Bot and Abuse Protection". — [Supabase Auth CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) (acc. 2026-10-12)
- Supabase's "Before User Created" hook can be a Postgres function or an HTTP endpoint. It receives `metadata.ip_address` and the user (email, provider), and "if the hook returns an error object, the signup is denied". The docs show allow/deny by domain and by IP/CIDR. Plan availability is not stated. — [Supabase Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) (acc. 2026-10-12)
- InsForge auth covers email/password, magic links, OTP, OAuth/OIDC and email verification. Its docs index has **no pages on CAPTCHA, Turnstile, rate limiting, disposable emails or auth hooks** (as of 2026-10-12). — [InsForge llms.txt](https://docs.insforge.dev/llms.txt), [InsForge Swift auth](https://docs.insforge.dev/sdks/swift/auth)

**Building blocks and costs**
- **Cloudflare Turnstile:** the free plan allows 20 widgets, 10 hostnames per widget and unlimited siteverify requests. It "can be used independently without requiring other Cloudflare services". Ephemeral IDs and any-hostname widgets are Enterprise-only. — [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/) (acc. 2026-10-12)
- **Twilio Verify:** "$0.05 per successful verification" plus "$0.0083 per SMS (US)". SMS attempts are billed even when not completed. Verify Fraud Guard (SMS pumping protection) is included. — [Twilio Verify pricing](https://www.twilio.com/en-us/verify/pricing) (acc. 2026-10-12)
- **disposable-email-domains list:** CC0-licensed and used by PyPI. Maintainers "can't guarantee every listed domain is still disposable". Check the domain and its parent domains. — [GitHub disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (acc. 2026-10-12)
- **Railway client IP:** header semantics are not officially documented as stable. Staff advise taking the first `X-Forwarded-For` value. Users report `X-Real-IP` sometimes carrying infrastructure IPs, and a thread asking for an "authoritative… proxy trust contract for secure rate limiting" was unresolved. — [Railway Station: which header](https://station.railway.com/questions/which-header-should-i-rely-on-for-real-c-d78a6f96), [Railway Station: trust contract](https://station.railway.com/questions/need-authoritative-railway-client-ip-p-b7a7b4bd), [Railway Station: XFF/X-Real-IP can't be trusted](https://station.railway.com/questions/edge-proxy-x-forwarded-for-and-x-real-ip-c5a50049) (community forum, 2026; acc. 2026-10-12)

### Inferences
- **Recommended layered setup for RankSEO**, roughly in order of cost/benefit. Each free report burns real Bright Data and Claude spend.
  1. **Turnstile** on sign-up (Better Auth captcha plugin, or Supabase's built-in CAPTCHA). Also verify a Turnstile token on the *report-creation* endpoint for free users, since the captcha plugin only covers auth routes. Free, with low friction.
  2. **Required email verification before any free credit is granted.** Create the user, but create the free buckets (2+2) only after `emailVerified = true`. Low friction.
  3. **Disposable-domain blocklist and email normalization** at sign-up (strip `+tag`; strip dots for gmail.com). Use the CC0 list in a Better Auth `before` hook, a Supabase Before User Created hook, or Sentinel `emailValidation`/`emailNormalization`. Low friction, with a small false-positive risk.
  4. **Velocity limits:**
     - sign-ups per IP (or /64) per hour, via a Better Auth custom rule with `storage: "database"` so it works across Railway replicas
     - a per-user concurrency limit (at most 1 in-flight free report)
     - a global daily spend circuit-breaker for free reports (e.g. stop free reports past N/day)
  5. **Key the free allowance to more than the account.** Track free-credit consumption per normalized email, per device fingerprint (Sentinel `freeTrialAbuse.maxAccountsPerVisitor` or Stripe Radar Session) and per IP. Return "restricted" (0 free credits, "add a card or upgrade") instead of blocking sign-up. This mirrors Stripe's `restricted` outcome semantics.
  6. **Backstops when abuse persists:**
     - Phone verification costs about $0.058 per verified US user (a fraction of one report's likely cost) but adds significant friction and is bypassable with temporary numbers.
     - Card-on-file is the strongest filter and a familiar SaaS pattern, but it lowers sign-up conversion.
     - Stripe Radar Account Evaluations is the "professional" option, but it needs Radar Pro (price not public) and preview API versions.
- **Railway-specific:** if Cloudflare (proxied DNS) sits in front of Railway, `cf-connecting-ip` is the trustworthy header *only if* the Railway origin cannot be hit directly. The default `*.up.railway.app` domain stays publicly reachable, so per Better Auth's own warning an attacker could spoof IP headers by calling the origin. The alternatives:
  - make Better Auth `trustedProxies` reflect Railway's edge and use the first `X-Forwarded-For` hop
  - remove the public Railway domain and route only through Cloudflare
  - Either way, verify on your own deployment, since Railway does not document a stable contract.
- **How this fixes the current build's abuse gaps:**
  - No email verification: add requirement (2).
  - No CAPTCHA: add (1).
  - No rate limiting: add (4).
  - Farming via scripted sign-ups: fixed by (2)+(3)+(5) together. No single control is sufficient.

### Gaps
- Radar Pro pricing and whether Account Evaluations is GA (examples use a `.preview` API version) were not found.
- Better Auth Infrastructure pricing has two conflicting pages, and it is unclear whether Sentinel needs the Pro tier.
- No independent measurement of each control's effectiveness was found. The figures are Stripe's (primary) or vendor anecdotes.
- InsForge has no documented CAPTCHA or rate-limit features (as of the docs index), so its abuse controls would have to be custom edge functions. This is unverified with InsForge directly.
- Whether Supabase's Before User Created hook is on the free plan was not stated.
- RankSEO's actual cost per report (Bright Data + Claude) is not known here, so the break-even for phone verification or card-on-file can't be computed.

---

## 5. Merchant of record (Polar, Paddle, Lemon Squeezy, Dodo Payments, Stripe Managed Payments) vs Stripe direct for a solo founder: tax, fees, payouts, lock-in

### Takeaway
- **Stripe direct** (2.9% + 30¢ + 0.7% Billing, plus 0.5% Stripe Tax where registered) is the cheapest per transaction and fits the existing Better Auth Stripe plugin. You remain the merchant and owe registration, filing and remittance.
- **MoRs** charge about 4–7% all-in and take over indirect tax and disputes.
  - In 2026 Polar raised its default to 5% + 50¢ for new orgs (from May 27, 2026).
  - Paddle and Lemon Squeezy are 5% + 50¢.
  - Dodo is 4% + 40¢ + 0.5% on subscriptions.
  - Stripe's own MoR (Managed Payments) adds 3.5% on top of standard processing and is Checkout/Payment Links-only.
- Polar and Dodo have Better Auth plugins. Paddle and Lemon Squeezy do not. Lemon Squeezy is being folded into Stripe Managed Payments, which makes it a poor choice for a new build.

### Cited Findings
**Stripe direct (acc. 2026-10-12)**
- Cards are 2.9% + 30¢ domestic. International cards add 1.5% and currency conversion adds 1%. — [Stripe pricing](https://stripe.com/pricing)
- Billing is 0.7% (pay-as-you-go). — [Stripe Billing pricing](https://stripe.com/billing/pricing)
- Stripe Tax:
  - 0.5% per transaction where you're registered (no-code), or
  - $0.50 per transaction via API (includes 10 calculation calls, then 5¢ each), or
  - Tax Complete from $90/mo on a 1-year contract.
  - Source: [Stripe pricing](https://stripe.com/pricing)
- Disputes are $15 received, $15 to counter (refunded if you win), or Smart Disputes at 30% of won amounts. Instant payouts cost 1.5% (50¢ minimum). Standard payouts are free. — [Stripe pricing](https://stripe.com/pricing)
- Outside Managed Payments, the merchant of record is "Your business", and indirect tax compliance is "Available with Tax". — [Stripe Managed Payments overview](https://docs.stripe.com/payments/managed-payments)

**Stripe Managed Payments (Stripe as MoR)**
- Fee: "3.5% per successful transaction, in addition to Payments fees." — [Stripe pricing](https://stripe.com/pricing) (acc. 2026-10-12)
- Coverage and constraints:
  - Handles sales tax, VAT and GST in **more than 80 countries**, plus fraud, disputes and transaction-level support.
  - Works only with Checkout and Payment Links.
  - Subscriptions are "Available with Billing".
  - Unsupported: Connect, Elements, and "creating a subscription outside of Checkout or Payment Links".
  - Source: [Stripe Managed Payments](https://docs.stripe.com/payments/managed-payments) (acc. 2026-10-12)
- Customer-facing behaviour:
  - Customers see Link as the seller ("Sold through Link"), and statements read `LINK.COM* [descriptor]`.
  - Custom domains aren't supported on Managed Payments checkouts.
  - Stripe "might issue a refund without your approval" if you don't respond within 48 hours, and can refund within 60 days "in certain cases".
  - A customer data-deletion request cancels their Managed Payments subscriptions.
  - Source: [Stripe Managed Payments: how it works](https://docs.stripe.com/payments/managed-payments/how-it-works) (acc. 2026-10-12)
- Invoices issued before April 6, 2026 "may show LemonSqueezy LLC" as the legal entity for Managed Payments fees. The current entity is "Sold through Link, LLC". — [Stripe support](https://support.stripe.com/questions/why-is-sold-through-link-llc-the-legal-entity-on-my-invoice-for-stripe-managed-payments-fees) (acc. 2026-10-12)
- Third-party timeline: Lemon Squeezy's January 2026 update said it is "building toward Stripe Managed Payments". Managed Payments entered public preview in Feb 2026 and gained a `managed_payments` Checkout flag in Apr 2026. — [Fungies](https://fungies.io/lemon-squeezy-stripe-acquisition-saas-founders-2026/) (competitor content, unverified). Competitor estimate of the domestic all-in rate: 6.4% + 30¢. — [Dodo blog](https://dodopayments.com/blogs/stripe-managed-payments-fees-explained) (competitor)

**Polar**
- From **May 20, 2026**, organizations created on or after **May 27, 2026** start on Starter at **5% + 50¢** with no subscription surcharge. Older orgs keep "Early Member" pricing (4% + 40¢ + 0.5% on subscriptions) indefinitely, and lose it if they upgrade to a paid plan. — [Polar blog: Introducing Polar Plans](https://polar.sh/blog/introducing-polar-plans)
- Paid plans: Pro $20/mo at 3.8% + 40¢; Growth $100/mo at 3.6% + 35¢; Scale $400/mo at 3.4% + 30¢. — [Polar blog](https://polar.sh/blog/introducing-polar-plans)
- Other fees:
  - International cards add 1.5%.
  - Payouts cost $2 per month of active payouts, plus 0.25% + $0.25 per payout, plus 0.25% (EU) to 1% cross-border.
  - Disputes are $15 regardless of outcome.
  - Transaction fees are not returned on refunds.
  - Polar "may issue refunds at its own discretion up to 60 days" after purchase.
  - Source: [Polar fees](https://polar.sh/docs/merchant-of-record/fees) (acc. 2026-10-12)

**Paddle**
- 5% + 50¢ per Checkout transaction. This includes global tax compliance (collect, file, remit), fraud protection, chargeback handling and buyer support, with "no monthly fees, migration fees, or hidden extras". Bespoke pricing is available for products under $10 and for high volume. Subscription migration is offered at no extra cost. — [Paddle pricing](https://www.paddle.com/pricing) (acc. 2026-10-12; footer "2012—2026")

**Lemon Squeezy**
- 5% + 50¢ per transaction. "Some payments may be subject to additional fees", with small extra fees outside the US. Payouts go out twice monthly by bank or PayPal. The page carries "Lemon Squeezy + Stripe Managed Payments" banners. — [Lemon Squeezy pricing](https://www.lemonsqueezy.com/pricing) (acc. 2026-10-12)

**Dodo Payments**
- US cards: 4% + 40¢.
- Surcharges: subscriptions, usage-based billing and add-ons +0.5%; international cards +1.5%; BNPL or PayPal +3%.
- ACH/SEPA: 1.5% capped at $15 or €15.
- Refunds $1. Disputes $30.
- Payouts are listed as free, but the FAQ mentions a $5 fee on payouts under $1,000. This is a conflict on the page.
- USD SWIFT payouts for non-US businesses cost $25.
- Tax handled in "220+ countries and regions". The page is undated.
- Source: [Dodo pricing](https://dodopayments.com/pricing) (acc. 2026-10-12)

**Better Auth support for each MoR**
- Better Auth has payment plugins for Stripe, Polar, Autumn, Dodo Payments, Creem, Chargebee and Commet. There are **no Paddle or Lemon Squeezy pages**. — [Better Auth docs index](https://better-auth.com/docs/llms.txt) (acc. 2026-10-12)

### Inferences
- **Illustrative per-payment fees on a $49/mo US-card subscription.** These are my own arithmetic from the cited rates and exclude sales tax, FX, payouts and disputes:

  | Option | Fee on $49 | Share of $49 |
  |---|---|---|
  | Stripe direct + Billing | $2.06 | 4.2% |
  | Stripe direct + Billing + Tax (0.5%) | $2.31 | 4.7% |
  | Dodo (4% + 0.5% + 40¢) | $2.61 | 5.3% |
  | Polar Pro plan (3.8% + 40¢, plus $20/mo) | $2.26 | 4.6% |
  | Polar Starter / Paddle / Lemon Squeezy (5% + 50¢) | $2.95 | 6.0% |
  | Stripe Managed Payments (2.9% + 3.5% + 30¢) | $3.44 | 7.0% |
  | Stripe Managed Payments, if Billing's 0.7% also applies (subscriptions require Billing) | $3.78 | 7.7% |

  On a $490/yr annual payment: Stripe direct + Billing = 3.7%; Polar Starter or Paddle = 5.1%; Dodo = 4.6%. Polar's Pro plan ($20/mo) beats Starter at roughly 29+ payments a month of $49.
- **Choosing:**
  - **Mostly US customers, US entity, low international volume:** Stripe direct with the existing Better Auth Stripe plugin is cheapest and least disruptive. Add Stripe Tax when you cross state nexus thresholds.
  - **Material EU/UK/international B2C sales, and you don't want to register for VAT/GST:** an MoR is worth about 1–3 points.
    - Polar or Dodo keep the Better Auth plugin architecture: swap plugins, keep your own quota tables.
    - Paddle has no Better Auth plugin, so you'd hand-roll webhooks.
    - Stripe Managed Payments keeps you inside Stripe, so moving later to Stripe direct is the shortest exit. The costs are the highest fee, Checkout-only flows, Link branding, and possible Stripe-initiated refunds.
  - **Lemon Squeezy:** avoid for new builds while it transitions into Stripe Managed Payments.
- **Lock-in:**
  - With an MoR, the MoR is the seller of record and holds the customers' payment relationship. Changing providers later likely means re-collecting payment details or a provider-assisted migration; Paddle advertises *inbound* migration help.
  - Keeping quotas and entitlements in your own Postgres (sections 2 and 3), not in the billing provider, keeps provider switching to a webhook-mapping exercise.

### Gaps
- Stripe Managed Payments **seller-country eligibility** was not fetched (the eligibility page exists). Whether it fits depends on where the founder is incorporated.
- Not confirmed: whether Billing's 0.7% applies on top for Managed Payments subscriptions.
- Creem fees were not researched (it has a Better Auth plugin).
- Polar's international and payout fees on non-US payout accounts were not detailed.
- Dodo's payout fee conflict is unresolved.
- Subscription-portability (card data export) policies of each MoR were not researched.
- Founder's country and VAT/GST thresholds are unknown, so the tax-burden comparison stays qualitative.

---

## 6. Integration points and stack fit: (a) Better Auth + Postgres on Railway vs (b) InsForge or Supabase; Better Auth plugins, Supabase/InsForge integrations, MCP servers and agent-facing docs

### Takeaway
- **Stack (a), Better Auth + Postgres on Railway**, gives the cleanest quota story:
  - subscription rows (Better Auth Stripe/Polar/Dodo plugin), quota buckets and report rows sit in one Postgres, so reserve and report-insert share a transaction
  - Better Auth has first-party CAPTCHA (Turnstile), rate limiting and email verification
  - Railway's undocumented client-IP header contract is the main operational wrinkle
- **InsForge** (Payments in **private preview** since May 2026) mirrors Stripe into `payments.*` tables. It leaves entitlements and credit ledgers to you, via SQL triggers and RLS, and documents no CAPTCHA or rate limiting.
- **Supabase** has a mature Stripe Sync Engine (one-click since Dec 2025, now maintained under `stripe/sync-engine`), built-in Turnstile/hCaptcha and a Before User Created hook. Quotas are DIY in SQL/RPC either way.
- Stripe, Autumn, Dodo, InsForge and Better Auth all ship MCP servers and/or `llms.txt` docs.

### Cited Findings
**Better Auth (stack a)**
- Plugins exist for Stripe, Polar (`@polar-sh/better-auth`), Autumn (`autumn-js/better-auth`), Dodo Payments (`@dodopayments/better-auth`), Creem, Chargebee and Commet. Security plugins cover Captcha, Rate Limit, Have I Been Pwned, Email OTP, Phone Number and Sentinel (Infrastructure). Docs are at v1.7, with a v1.6 index. — [Better Auth docs index](https://better-auth.com/docs/llms.txt), [Better Auth llms.txt](https://www.better-auth.com/llms.txt) (acc. 2026-10-12)
- Better Auth offers a documentation MCP server at `https://mcp.better-auth.com/mcp`. — [Better Auth llms.txt](https://www.better-auth.com/llms.txt) (acc. 2026-10-12)
- The Stripe plugin stores subscription state in your own database (`subscription` table, `user.stripeCustomerId`). — [schema.ts](https://raw.githubusercontent.com/better-auth/better-auth/main/packages/stripe/src/schema.ts) (acc. 2026-10-12)
- A Railway template exists that deploys the Stripe Sync Engine (Fastify server with `/webhooks`). — [Railway template](https://railway.com/deploy/stripe-sync-engine--stripe-sync-engine) (via search; acc. 2026-10-12)

**InsForge (stack b1)**
- "Introducing InsForge Payments", **May 6, 2026**: "Payments is currently in private preview."
  - Setup: Stripe test or live keys go in via dashboard or CLI. InsForge then syncs the catalog, configures and verifies managed webhooks (handling retries and dedupe), and creates Checkout and Billing Portal sessions from InsForge routes.
  - Refunds and disputes stay in Stripe.
  - Quotas, credits and entitlements are not platform features.
  - The post does not mention MCP. Pricing is not stated.
  - Source: [InsForge Payments blog](https://insforge.dev/blog/insforge-payments)
- Providers are Stripe and Razorpay. "InsForge is not a payment processor or merchant of record."
  - Mirrored tables: `payments.stripe_checkout_sessions`, `payments.stripe_customer_portal_sessions`, `payments.stripe_products`, `payments.stripe_prices`, `payments.stripe_subscriptions`, `payments.stripe_subscription_items`.
  - Shared tables: `payments.customers`, `payments.customer_mappings`, `payments.webhook_events` (the "durable fulfillment" basis) and `payments.transactions`.
  - Source: [InsForge payments overview](https://docs.insforge.dev/core-concepts/payments/overview) (acc. 2026-10-12)
- The docs include MCP setup (Cursor, Claude, Windsurf), a VS Code extension, Edge Functions (HTTP, cron, DB triggers), pg_cron schedules and Realtime. They include **no CAPTCHA or rate-limit pages**. — [InsForge llms.txt](https://docs.insforge.dev/llms.txt), [InsForge MCP setup](https://docs.insforge.dev/mcp-setup) (acc. 2026-10-12)

**Supabase (stack b2)**
- The Stripe Sync Engine became an official one-click Dashboard integration on **Dec 19, 2025**. It uses webhooks for real-time updates and scheduled backfills, writes ordinary Postgres tables (customers, subscriptions, invoices, payments), and has a Stripe FDW alternative that makes an API call per query. — [Supabase blog: Stripe Sync Engine integration](https://supabase.com/blog/stripe-sync-engine-integration)
- On **Apr 14, 2026** the repo moved from `supabase/stripe-sync-engine` to `stripe/sync-engine`. It remains Apache-2.0, both companies keep developing it, and the Dashboard integration continues to work. — [Supabase blog: transfer](https://supabase.com/blog/stripe-sync-engine-transfer)
- CAPTCHA (hCaptcha or Turnstile) and the Before User Created hook are covered in section 4. Column-level security caveats are covered in section 3. — [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [Supabase hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [Supabase CLS](https://supabase.com/docs/guides/database/postgres/column-level-security)

**MCP and agent-facing docs**
- **Stripe MCP:**
  - Remote server at `https://mcp.stripe.com`, using OAuth or Agent API keys. Tools include `stripe_api_search`, `stripe_api_read`, `stripe_api_write`, `search_stripe_documentation` and `stripe_implementation_planner`.
  - Human confirmation is required for refunds and similar writes.
  - "Beginning October 31, 2026, Stripe MCP no longer accepts full-access secret keys or restricted API keys without the Agent tag."
  - `stripe agent setup` installs Stripe's agent plugin and skills.
  - Source: [Stripe MCP docs](https://docs.stripe.com/mcp) (acc. 2026-10-12)
- **Autumn:** an MCP Server docs page and `llms.txt`. The free tier includes "CLI and MCP". — [Autumn llms.txt](https://docs.useautumn.com/llms.txt), [Autumn MCP](https://docs.useautumn.com/documentation/mcp), [Autumn pricing](https://useautumn.com/pricing) (acc. 2026-10-12)
- **Dodo:** the agent plugin bundles an API MCP server (browser OAuth) and a docs-search MCP server, plus skills including credit-based billing and Better Auth integration. — [Dodo agent docs](https://docs.dodopayments.com/developer-resources/build-with-ai-coding-agents) (via search summary; acc. 2026-10-12)
- **Polar:** docs are served as `.md` pages (e.g. `polar.sh/docs/...md`), which suits agents. — [Polar credits .md](https://polar.sh/docs/features/usage-based-billing/credits.md) (acc. 2026-10-12). No Polar MCP server was verified.
- **Lago:** a competitor claims Lago's MCP server sits in the Premium tier. — [Flexprice glossary](https://flexprice.io/glossary/open-source-billing) (unverified)

### Inferences
**Comparison by concern**

- **Subscription state in your DB**
  - (a) Better Auth + Postgres on Railway: Better Auth plugin `subscription` table (Stripe, or the Polar/Dodo plugins).
  - (b1) InsForge: `payments.stripe_subscriptions` mirror (private preview).
  - (b2) Supabase: Stripe Sync Engine tables.
- **Atomic quota + report creation**
  - (a): same Postgres and same transaction, straightforward.
  - (b1): same Postgres, but via SQL function, RPC or edge function.
  - (b2): same Postgres via SQL function or RPC (`security definer`).
- **Long-running report jobs (Bright Data + Claude)**
  - (a): Railway worker or service, with no execution time caps documented here.
  - (b1): edge functions or an external worker. Limits not researched.
  - (b2): edge functions or an external worker. Limits not researched.
- **Paid-field gating**
  - (a): server serializer.
  - (b1): RLS on separate rows, or a server function.
  - (b2): RLS on separate rows, or RPC. Column privileges are discouraged.
- **CAPTCHA, rate limit, email verification**
  - (a): first-party plugins. Railway IP-header caveat.
  - (b1): email verification yes. CAPTCHA and rate limiting not documented, so DIY.
  - (b2): CAPTCHA built-in; Before User Created hook for domain/IP rules.
- **Swapping to an MoR**
  - (a): change plugin (Polar, Dodo, Creem).
  - (b1): Razorpay or Stripe only, today.
  - (b2): Stripe-centric sync. MoR webhooks are DIY.
- **Agent ergonomics**
  - (a): Better Auth docs MCP and llms.txt, plus Stripe MCP.
  - (b1): InsForge MCP; agent sets up payments from a prompt.
  - (b2): Stripe MCP; Supabase MCP not checked here.

- **Overall:** for RankSEO's specific needs (atomic money-backed quotas, cheap layered abuse controls, an optional MoR swap), stack (a) needs the least custom plumbing. InsForge's payments are still private preview and leave the hard parts (quotas, entitlements, abuse) to you. Supabase is the stronger BaaS option for this topic, thanks to its built-in CAPTCHA, signup hook and mature Stripe sync, but quota logic still lives in SQL functions you write.
- Whichever stack is chosen, the quota and entitlement layer (sections 2 and 3) is roughly 100–200 lines of SQL and server code. Billing-provider choice and quota design are therefore independent decisions.

### Gaps
- InsForge Payments pricing and GA date were not found.
- InsForge edge-function runtime limits for multi-minute report jobs were not researched (likely covered by another researcher).
- Supabase MCP and Polar MCP were not verified in this research.
- Railway's long-running job limits were not checked here.
- Better Auth Infrastructure (Sentinel) pricing has conflicting sources (section 4).
