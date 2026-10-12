# InsForge (insforge.dev): the "agent-native" backend platform, profiled as a foundation for the RankSEO rebuild (state as of 12 Oct 2026)

_How facts are dated: an undated fact comes from a live vendor page or doc I retrieved on 2026-10-12. Vendor docs and pricing pages carry no publish date, so they reflect what the site said that day. A fact with a publish date shows it. A fact older than about 12 months is marked **(possibly stale)**. Anything InsForge says about itself is labelled **vendor claim**._

## 1. What exactly is InsForge? Every component, and the architecture underneath

### Takeaway
InsForge is an open-source backend-as-a-service under the Apache-2.0 license, built in the style of Supabase. It runs Postgres 15 with PostgREST 12.2 and Deno edge functions, and it bundles auth, storage, realtime, cron, a model gateway that is really OpenRouter, Stripe/Razorpay payments, email, frontend hosting (on Vercel) and container compute (on Fly.io). All of it is driven through a CLI and an MCP server built for coding agents. Several of these "products" are thin wrappers over third-party services. It has no queue product and no workflow engine.

### Cited Findings
- The project describes itself as "the all-in-one, open-source backend platform for agentic coding". The license is **Apache-2.0**, and the repo `InsForge/InsForge` was created on 2025-07-29 — [GitHub repo](https://github.com/InsForge/InsForge); [GitHub org listing via search API, retrieved 2026-10-12](https://github.com/InsForge)
- The docs say "InsForge ships ten products", each exposed through the same REST surface, the same JWT auth, the same MCP server and the same SDKs. The ten are Database, Authentication, Storage, Realtime, Edge Functions, Model Gateway, Sites, Messaging, Payments and Compute — [Products doc](https://docs.insforge.dev/products). The homepage also lists **Analytics (PostHog)**, and the docs add a **Web Scraper (Apify integration)** — [insforge.dev](https://insforge.dev); [Analytics doc](https://docs.insforge.dev/core-concepts/analytics/overview); [docs index](https://docs.insforge.dev/llms.txt)
- **Database.** The architecture diagram shows SDK → InsForge API → **PostgREST v12.2** → **PostgreSQL 15**, with RLS, triggers, stored functions and multiple schemas. Every table automatically becomes a REST and SDK endpoint. pgvector is included, with HNSW and IVFFlat indexes — [Database overview](https://docs.insforge.dev/core-concepts/database/overview)
- **Migrations** are plain timestamped `.sql` files. They are forward-only, each runs inside a transaction, and applied migrations are recorded in `system.custom_migrations`. The CLI `db query` paths enforce a 30-second `statement_timeout` — [Migrations doc](https://docs.insforge.dev/core-concepts/database/migrations)
- **Auth** covers email/password, magic link and OTP, OAuth (Google, GitHub, Apple, Microsoft, GitLab, Discord, plus custom OAuth2/OIDC), JWT sessions and an "OAuth server mode". Users live in the `auth` schema of your own Postgres — [Auth overview](https://docs.insforge.dev/core-concepts/authentication/overview)
- **Storage** is S3-compatible, with signed URLs and row-level policies — [Products doc](https://docs.insforge.dev/products)
- **Edge Functions** are TypeScript running on Deno. In the cloud they run on **Deno Subhosting**; self-hosted, they run on a local Deno runtime — [REST Functions doc](https://docs.insforge.dev/sdks/rest/functions)
- **Schedules (cron)** are built on **pg_cron**, which calls a function URL — [Schedules doc](https://docs.insforge.dev/core-concepts/functions/schedules)
- **Realtime** delivers DB-change events (published from triggers), broadcast and presence over WebSockets using a Socket.IO contract. It also has webhook fan-out and RLS on channels — [Realtime overview](https://docs.insforge.dev/core-concepts/realtime/overview)
- **Model Gateway** is "OpenRouter-backed chat, streaming, and embeddings through one InsForge-managed key" — [Products doc](https://docs.insforge.dev/products)
- **Sites** deploys frontends to **Vercel**. The default server-function region is `iad1` — [Sites doc](https://docs.insforge.dev/core-concepts/sites/overview)
- **Compute** runs long-running Docker containers. On InsForge Cloud they run on **Fly.io** — [FAQ](https://docs.insforge.dev/faq); [Compute doc](https://docs.insforge.dev/core-concepts/compute/overview). The README labels Compute "**private preview**" — [GitHub README](https://github.com/InsForge/InsForge)
- **Messaging** is transactional email only today. The managed sender is AWS SES, and "SMS and push [are] on the roadmap" — [Messaging overview](https://docs.insforge.dev/core-concepts/messaging/overview)
- **Payments** supports Stripe Checkout, Subscriptions and Billing Portal, plus Razorpay — [Payments overview](https://docs.insforge.dev/core-concepts/payments/overview)
- **Infrastructure.** Each cloud project "runs on its own dedicated server that hosts the project's backend: the API server and its Postgres database" — [Pricing page](https://insforge.dev/pricing). Backend branches each run "on its own EC2 instance" — [Branching doc](https://docs.insforge.dev/agent-native/branching). The status page tracks AWS EC2, AWS S3, a "Deno Edge Network" and OpenRouter as dependencies — [Status page](https://insforge.status.io)
- **Self-hostable** with Docker Compose v2. The compose stack includes PostgreSQL, PostgREST and Deno — [GitHub README](https://github.com/InsForge/InsForge); [Hetzner self-host guide](https://docs.insforge.dev/deployment/deploy-to-hetzner)
- **No queue product, workflow engine or vector DB separate from pgvector is documented.** Neither the docs index nor the full-docs dump has a page for queues. The functions overview sends "queue workers" to Compute — [docs index](https://docs.insforge.dev/llms.txt); [Functions overview](https://docs.insforge.dev/core-concepts/functions/overview)

### Inferences
- This is architecturally a Supabase-like stack: Postgres, PostgREST, Deno functions, RLS and the JWT-claims pattern. Postgres and SQL skills and code carry over well, but the SDK and the internal schemas are InsForge-specific.
- "One platform" still hides a chain of sub-vendors: AWS, Deno Subhosting, OpenRouter, Vercel, Fly.io, SES, and optionally PostHog and Apify. InsForge consolidates billing and the interface, not the dependency chain.

### Gaps
- I found no public architecture document covering HA or failover, Postgres replicas, or connection pooling for the cloud.
- The exact Deno version and PostgREST and Postgres minor versions running in cloud today are not stated beyond "PostgREST v12.2 / PostgreSQL 15" in a diagram.

## 2. How does the agent-native workflow work, which agents are supported (Claude Code specifically), and what do the benchmark claims show?

### Takeaway
The workflow is a CLI built for agents (`npx @insforge/cli`, with `--json` and `--yes`), plus "Skills", a remote MCP server, config-as-code (`insforge.toml`), migration files, backend branching and a diagnostics/advisor command. Claude Code is explicitly supported. Every benchmark comes from InsForge itself, and I found no independent reproduction. InsForge's own June 2026 benchmark even shows its MCP server slightly behind Supabase MCP on strict stability, while its CLI+Skills path scored best.

### Cited Findings
- The docs offer two ways to connect: the CLI (`npx @insforge/cli login`, then `link`), and MCP "if your editor speaks it (Claude Code, Cursor, Windsurf, Codex)". An agent directory lists tested setups — [Introduction](https://docs.insforge.dev/introduction)
- **Remote MCP** is installed with `npx add-mcp https://mcp.insforge.dev/mcp`. Supported clients are Claude Code, Claude Desktop, Codex, Cursor, Gemini CLI, Goose, GitHub Copilot, OpenCode, VS Code and Zed. The page also has per-client instructions for Antigravity, Kiro, Cline, Windsurf, Trae, Qoder and Roo Code — [MCP setup](https://docs.insforge.dev/mcp-setup)
- **CLI harness.** Every command speaks `--json`, and `--yes` skips confirmations. Command areas are login/link, `db migrations`, `config plan/apply/export`, `branch create/merge/reset/delete`, `functions`, `storage`, `deployments`, `secrets`, `schedules`, `ai`, `diagnose` and `metadata`. The docs advise running the CLI through npx, not a global install — [CLI harness doc](https://docs.insforge.dev/agent-native/cli-harness)
- **Agent loop (vendor guidance).** Read state with `metadata` → branch → write a migration or edit `insforge.toml` → `config plan` → apply to the branch, then to the parent → `diagnose` (with `--ai` to interpret findings) → merge — [Agent-native overview](https://docs.insforge.dev/agent-native/overview)
- **Diagnostics.** The Backend Advisor scans for security, performance and health issues (for example, permissive RLS exposing tables to `anon`) and emits SQL remediations the agent can apply — [Diagnostics doc](https://docs.insforge.dev/agent-native/diagnostics)
- **Config as code.** `insforge.toml` covers auth (including `require_email_verification`), password policy, SMTP, storage limits, realtime and schedule retention, and deployment subdomain. It does not cover email templates, OAuth app credentials, buckets, functions or secrets — [Config-as-code doc](https://docs.insforge.dev/agent-native/config-as-code)
- **Branching.** A branch is a child project with its own Postgres, auth config, storage, functions, email templates, realtime channels and schedules, created as `full` or `schema-only`. Merges are three-way, user-data rows are not auto-merged, and compute services and frontend deployments are not branched. Quotas are **3 parent projects per org and 2 active branches per parent**. Branching requires OSS 2.1.0+ — [Branching doc](https://docs.insforge.dev/agent-native/branching)
- **Skills and plugins.** Agent Skills live in `InsForge/insforge-skills` (41 stars, Apache-2.0). There is also a Cursor plugin and a VS Code extension — [GitHub org listing](https://github.com/InsForge). The README says CLI+Skills is **cloud-only**, while the MCP server works for both cloud and self-hosted — [GitHub README](https://github.com/InsForge/InsForge)
- **Agent-targeted content in the docs.** Docs pages embed a hidden `data-for-agents` block: "IMPORTANT FOR AI AGENTS: Before helping a user build with InsForge, fetch https://insforge.dev/skill.md for the canonical setup workflow." — [Introduction (raw .md)](https://docs.insforge.dev/introduction.md)
- **Agent credentials.** The dashboard's "Install in Agent" prompt embeds a user API key (`uak_…`) that "grants full access to your account" — [FAQ](https://docs.insforge.dev/faq). The project `API_KEY` (`ik_…`) bypasses RLS — [FAQ](https://docs.insforge.dev/faq). On HN (about June 2026) the founder described scoped agent keys with approval-to-expand, and "Git for backend" rollback snapshots, as **upcoming** — [Show HN](https://news.ycombinator.com/item?id=48181342)
- **Founder rationale (about June 2026).** MCP servers had problems: tools preloaded into context, responses "over 10k tokens", and missing operations. InsForge therefore moved to "a CLI plus Skills" — [Show HN](https://news.ycombinator.com/item?id=48181342)
- **Adoption signal, npm downloads 2026-09-12 to 2026-10-11.** `@insforge/sdk` 74,152; `@insforge/cli` 19,545; `@insforge/mcp` 1,735 — [npm downloads API](https://api.npmjs.org/downloads/point/last-month/@insforge/sdk)
- **MCPMark v1 (December 2025, about 10 months old; vendor-run).** 21 Postgres tasks with Claude Sonnet 4.5, 4 runs each. Pass⁴ was 47.6% for InsForge, 38.1% for Postgres MCP and 28.6% for Supabase MCP. Tokens per run were 8.2M, 10.4M and 11.6M — [InsForge blog v1](https://insforge.dev/blog/mcpmark-benchmark-results)
- **MCPMark v2 (2026-03-02, by CTO Tony Chang; vendor-run).** Claude Sonnet 4.6, 21 tasks, 4 runs:

  | Metric | InsForge MCP | Supabase MCP |
  |---|---|---|
  | Pass⁴ | 42.86% | 33.33% |
  | Pass@1 | 58.33% | 47.62% |
  | Pass@4 | 76.19% | 66.67% |
  | Tokens per run | 7.3M | 17.9M |
  | Avg time per task | 156.6s | 198.8s |

  The post does not give the Supabase MCP version tested — [InsForge blog v2](https://insforge.dev/blog/mcpmark-benchmark-results-v2)
- **"Agent Benchmark: First Look" (2026-06-08; vendor-run, "preliminary").** 30 database tasks (access control, integrity, vector), k=3 runs each. The model and harness are not stated. Pass^3 results: InsForge CLI+Skills 27/30, Supabase MCP 24/30, InsForge MCP 23/30, Supabase MCP+Skills 20/30, Supabase CLI+Skills 18/30. Passed attempts: InsForge CLI+Skills 86/90, Supabase MCP 79/90, InsForge MCP 76/90 — [InsForge blog](https://insforge.dev/blog/agent-benchmark-first-look)
- **Independent verification.** I found none. Third-party articles repeat the vendor numbers, for example a "2.8x" token claim — [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/3573/insforge-2-8x-token-claude-code-backend-agent-native-2026-en). A search summary of the Sealos comparison says MCPMark has a peer-reviewed paper but that Sealos had not reproduced InsForge's numbers. Sealos also publishes InsForge deployment tutorials, so it is not disinterested — [Sealos](https://sealos.io/blog/insforge-vs-supabase/)

### Inferences
- For Claude Code the integration is real and well documented, and the CLI-first approach suits Claude Code's Bash tool well. Migrations as files, `insforge.toml` and branching are genuinely useful guardrails for agent-driven changes.
- The benchmark numbers only show that InsForge's database tooling is competitive on database tasks. They say nothing about auth, payments, jobs or production reliability. The 21-task and 30-task samples are small, and in InsForge's own newer benchmark its MCP server was not better than Supabase MCP.
- Security hygiene matters. Account-wide `uak_` keys in agent context, and docs that carry hidden instructions aimed at agents, mean an agent with this setup can do anything on the account. Scoped agent keys were still only on the roadmap as of mid-2026.

### Gaps
- I could not confirm whether scoped agent keys, approval gates or rollback snapshots have shipped. Approval gates appear in InstaCloud — [instacloud-oss README](https://github.com/InsForge/instacloud-oss) — but not in the InsForge docs.
- I did not find whether MCPMark's maintainers list InsForge on any official leaderboard.

## 3. Auth: email verification, OAuth, password reset, rate limiting, CAPTCHA, session model — and can Better Auth be used with it or instead of it?

### Takeaway
Native auth covers email verification, which can be required and uses a 6-digit code or a link. It also covers password reset by code or link, OTP/magic link, a long list of OAuth providers, and httpOnly refresh cookies with CSRF tokens. **There is no CAPTCHA, no native MFA, and no documented rate-limit numbers for end-user login.** The vendor only says "brute-force throttling [is] built in". Better Auth is a **first-class, documented integration**: it runs in your Next.js app, stores its tables in a `better_auth` schema in the InsForge Postgres, and bridges to RLS through a JWT signed with InsForge's secret.

### Cited Findings
- "Password reset, email verification, and brute-force throttling are built in" (**vendor claim; no numbers given**) — [Auth overview](https://docs.insforge.dev/core-concepts/authentication/overview)
- Config keys are `require_email_verification`, `verify_email_method = "code" | link`, `reset_password_method`, `disable_signup`, `allowed_redirect_urls`, and a password policy (`min_length`, `require_number`, …) — [Config-as-code doc](https://docs.insforge.dev/agent-native/config-as-code)
- If `requireEmailVerification` is true, sign-up returns no tokens until the user verifies. Link verification goes through an InsForge endpoint and then redirects to `redirectTo` — [REST auth doc](https://docs.insforge.dev/sdks/rest/auth)
- Email OTP codes "expire after 5 minutes, can be used once, and are consumed after three failed attempts" — [REST auth doc](https://docs.insforge.dev/sdks/rest/auth); shipped in v2.2.9 (2026-07-27) — [Changelog](https://insforge.dev/changelogs)
- **Sessions.** Login returns an access JWT. Web clients get the refresh token in an **httpOnly cookie** plus a `csrfToken` that must be sent as `X-CSRF-Token` on refresh. `client_type=server` returns the refresh token in the body for "SSR apps, BFFs". The SDK's automatic refresh is browser-only — [REST auth doc](https://docs.insforge.dev/sdks/rest/auth); [TS auth doc](https://docs.insforge.dev/sdks/typescript/auth). RS256 login tokens became verifiable via JWKS, with HS256 fallback, in v2.2.5 (2026-07-04) — [GitHub releases](https://github.com/InsForge/InsForge/releases)
- **Rate limits that are documented:**
  - OAuth-server-mode endpoints only: `/authorize` 100/min/IP, `/token` 50/min/client, `/profile` 100/min/token — [OAuth Server doc](https://docs.insforge.dev/oauth-server)
  - Custom-SMTP per-recipient minimum interval, default 60 s — [Custom SMTP doc](https://docs.insforge.dev/core-concepts/messaging/custom-smtp)
  - S3 key management: 20 requests per 15 min per IP — [storage OpenAPI via full docs](https://docs.insforge.dev/llms-full.txt)
- **CAPTCHA, Turnstile or bot protection:** zero matches in the full documentation dump (about 1.1 MB) — [llms-full.txt](https://docs.insforge.dev/llms-full.txt)
- **MFA, TOTP or passkeys:** not native. They are only mentioned through Better Auth plugins or Kinde — [Better Auth integration](https://docs.insforge.dev/integrations/better-auth); [llms-full.txt](https://docs.insforge.dev/llms-full.txt)
- **Self-hosted email.** It requires Custom SMTP, or no verification, reset or OTP emails are sent. Cloud uses a managed sender (AWS SES) — [Custom SMTP doc](https://docs.insforge.dev/core-concepts/messaging/custom-smtp); [Messaging overview](https://docs.insforge.dev/core-concepts/messaging/overview)
- **Better Auth integration:**
  - `npx @insforge/cli link --project-id <id> --auth better-auth` scaffolds Better Auth into a Next.js app, with a **bridge route `/api/insforge-token`** that reads Better Auth's session cookie and signs an HS256 JWT with InsForge's secret, so PostgREST and RLS accept it.
  - Better Auth tables go in a `better_auth` schema that is hidden from the data API, and a `requesting_user_id()` SQL helper is created.
  - On cloud it needs a Postgres connection string; the CLI pre-fills `DATABASE_URL` from the linked project.
  - Better Auth plugins (organization, twoFactor, apiKey, passkey) inherit the same schema isolation.

  — [Better Auth integration](https://docs.insforge.dev/integrations/better-auth)
- **Other bring-your-own-auth integrations:** Clerk, Auth0, WorkOS, Kinde and Stytch, each by signing a JWT with `role: authenticated`, `aud: insforge-api` and `sub` — [Auth integrations](https://docs.insforge.dev/integrations/overview)
- **Open auth issues (2026):** #1215 duplicate OTP emails on re-signup with a deleted email (open, May 2026); #1508 anonymous sign-in endpoint (open feature request, June 2026) — [GitHub issues](https://github.com/InsForge/InsForge/issues?q=is%3Aissue+sort%3Acomments-desc)

### Inferences
- For RankSEO's "email verification + rate limiting/CAPTCHA" requirement, native InsForge auth covers verification but not CAPTCHA. Rate limits are an undocumented black box. The most robust option on InsForge is **Better Auth plus the bridge**, which keeps Better Auth's own rate limiting, captcha and Stripe plugins (verify in the Better Auth notes) while using InsForge Postgres, RLS and realtime.
- The trade-off of the Better Auth route: InsForge's Auth > Users page stays empty, RLS must use `requesting_user_id()` rather than `auth.uid()`, and InsForge-native features keyed to InsForge users (payments' "InsForge user token", realtime RLS examples) need checking with bridged tokens.
- Next.js App Router SSR has no dedicated InsForge guide; only the `client_type=server` mode is documented. An npm `ssr` prerelease tag exists (`1.3.0-ssr.3`) — [npm registry](https://www.npmjs.com/package/@insforge/sdk) — which suggests SSR helpers are not GA.

### Gaps
- The access-token TTL for app users is not documented. Only the OAuth-server mode says "Access tokens expire in 1 hour" ([llms-full.txt](https://docs.insforge.dev/llms-full.txt)).
- There are no numbers for the "brute-force throttling" (attempt limits, lockout windows) and no per-IP sign-up limits.
- It is unverified whether InsForge Payments' Stripe checkout works with Better Auth-bridged JWTs.

## 4. Payments: is there native Stripe support, and how would subscriptions, webhooks and atomic usage quotas be implemented?

### Takeaway
Yes. InsForge Payments is a real Stripe integration. It stores keys server-side, creates Checkout and Billing Portal sessions, auto-manages the Stripe webhook endpoint, mirrors products, prices, customers and subscriptions into a `payments` schema, and keeps a verified `payments.webhook_events` ledger. Entitlements and usage quotas are not a feature: you write Postgres trigger functions and app-owned tables yourself. Atomic quotas are therefore ordinary Postgres engineering (an RPC function with a conditional `UPDATE` or row locks), which the stack fully supports.

### Cited Findings
- InsForge "stores Stripe secret keys server-side, creates Checkout and Billing Portal sessions from your app, automatically manages the Stripe webhook endpoint when your backend is reachable, mirrors Stripe state into the `payments` schema, and records verified webhook events." Setup is `payments stripe config set`, `sync` and `webhooks configure` (separate test and live) — [Stripe Payments doc](https://docs.insforge.dev/core-concepts/payments/stripe)
- Tables:
  - Stripe-specific: `payments.stripe_products`, `stripe_prices`, `stripe_subscriptions`, `stripe_subscription_items`, `stripe_checkout_sessions`, `stripe_customer_portal_sessions`
  - Shared: `payments.customer_mappings`, `payments.webhook_events` ("Use this for durable fulfillment triggers"), `payments.transactions` (a reporting projection, "not the fulfillment contract")

  — [Payments overview](https://docs.insforge.dev/core-concepts/payments/overview)
- Subscription checkout takes a **billing subject** (user, team, org, and so on) and an `idempotencyKey`. InsForge stamps `insforge_subject_type` and `insforge_subject_id` into subscription metadata. The checkout insert runs with the caller's token, so you must add RLS (INSERT and SELECT policies) restricting which subjects a user may bill — [Stripe Payments doc](https://docs.insforge.dev/core-concepts/payments/stripe)
- The recommended fulfillment pattern is `AFTER INSERT OR UPDATE` triggers on `payments.webhook_events` (SECURITY DEFINER plpgsql) writing to app tables such as `public.team_entitlements` or `public.credit_ledger`. The example grants a plan on `invoice.paid` with `ON CONFLICT DO UPDATE` — [Stripe Payments doc](https://docs.insforge.dev/core-concepts/payments/stripe)
- **Ordering caveat (vendor-documented).** "Stripe gives no ordering guarantee across events: `invoice.paid` can be processed before `checkout.session.completed`." Resolve the subject from the event payload first. "Never let fulfillment skip silently — log or dead-letter events you cannot resolve so they can be replayed." — [Stripe Payments doc](https://docs.insforge.dev/core-concepts/payments/stripe)
- InsForge "is not a payment processor or merchant of record". Stripe remains the source of truth for charges, invoices, refunds and taxes — [Payments overview](https://docs.insforge.dev/core-concepts/payments/overview)
- The SDK calls are `insforge.payments.stripe.createCheckoutSession(...)` and `createCustomerPortalSession(...)`. "Payment runtime calls require an InsForge user token." — [TS payments doc](https://docs.insforge.dev/sdks/typescript/payments)
- Postgres functions are callable over REST and SDK via PostgREST RPC (`client.database.rpc('my_function', {...})`). New tables have **RLS on by default**. The admin `ik_` key bypasses RLS — [FAQ](https://docs.insforge.dev/faq)
- Stripe integration history: the feature request was issue #543, closed 2026-03-17 — [GitHub issues](https://github.com/InsForge/InsForge/issues?q=is%3Aissue+sort%3Acomments-desc). Razorpay was added later — [Payments overview](https://docs.insforge.dev/core-concepts/payments/overview)
- InsForge's comparison page positions "Built-in Stripe integration" against Supabase's "Via app code" (**vendor claim**) — [Alternatives](https://docs.insforge.dev/alternatives)

### Inferences
- How the review findings map onto InsForge:
  - **UI-only paywall:** fix by putting the entitlement check inside the database. One SECURITY DEFINER function (exposed via RPC) checks the subject's active entitlement, consumes quota atomically, and inserts the job row in one transaction. Because the browser SDK talks to PostgREST directly, any table without correct RLS is effectively public, so paywall correctness lives in SQL policies and functions. The Backend Advisor helps catch permissive policies.
  - **Racy count-then-create quotas:** a per-subject, per-period usage row updated with `UPDATE … SET used = used + n WHERE subject = $1 AND period = $2 AND used + n <= quota RETURNING …`, or `SELECT … FOR UPDATE`, removes the race. This is generic Postgres, not an InsForge feature.
- There is no usage-based (metered) Stripe billing, no credit primitive and no entitlement API. InsForge saves the checkout, portal and webhook plumbing but not the quota logic, which is exactly the part the code review flagged.
- With Better Auth's Stripe plugin instead, Stripe state would live in Better Auth tables (`better_auth` schema) and InsForge Payments would go unused. Choose one owner of billing state to avoid duplicate webhooks.
- Trigger-based fulfillment is powerful but hard to unit-test and easy for agents to get subtly wrong (ordering, idempotency). It needs SQL-level tests, for example pgTAP or integration tests against a branch.

### Gaps
- No documented retry or replay mechanism for failed trigger fulfillment, beyond "log or dead-letter".
- No documented support for Stripe usage records/meters, coupons/trials configuration via InsForge, or Stripe Tax specifics.

## 5. Background work and realtime: can functions run long jobs or wait minutes for a third-party webhook? Timeouts, cron, queues, retries, and streaming progress to the browser

### Takeaway
Edge functions are short-lived request/response handlers, with a timeout of about 30 to 60 s depending on the source. Cron is pg_cron at a one-minute minimum, and failed runs are not retried. **There is no queue, durable workflow, retry policy or "wait for webhook" primitive.** Long-running work goes to Custom Compute, which is Fly.io-backed containers labelled private preview, with one instance per service and no persistent volumes. Realtime is well suited to streaming job progress: a DB trigger calls `realtime.publish()`, which pushes to RLS-guarded WebSocket channels. A 15-minute Bright Data wait has to become an event-driven state machine in Postgres, not a waiting function.

### Cited Findings
- "Edge Functions are for request/response and short-lived jobs." Queue workers and always-on processes belong on Compute. Functions can be invoked over HTTP at `https://<project>.insforge.dev/functions/<name>`, from DB triggers (INSERT/UPDATE/DELETE, run with a service-role JWT), or on cron. There is no bundler; `npm:`/`jsr:`/`esm.sh` imports work — [Functions overview](https://docs.insforge.dev/core-concepts/functions/overview)
- **Timeout, conflicting sources:**
  - A now-removed docs page ("Functions architecture") listed a **30-second timeout** for cloud (Deno Subhosting) and self-hosted, plus a **10 MB payload limit**. This comes from a search-engine snippet; the URL returned "Page Not Found" on 2026-10-12 — [functions/architecture.md](https://docs.insforge.dev/core-concepts/functions/architecture.md)
  - The repo's `.env.example` says "Edge-function execution timeout in milliseconds. `# WORKER_TIMEOUT_MS=60000`" (self-hosted default 60 s) — [.env.example](https://raw.githubusercontent.com/InsForge/InsForge/main/.env.example)
  - The current functions overview gives no number — [Functions overview](https://docs.insforge.dev/core-concepts/functions/overview)
- **Schedules.** pg_cron, standard 5-field cron, **minimum interval 1 minute**. "Failed runs are logged but not retried, so the function must be idempotent." Logs go to `schedules.job_logs`. An idle keep-alive quirk can stall the first request by about 30 s — [Schedules doc](https://docs.insforge.dev/core-concepts/functions/schedules). This **contradicts** the functions overview, which says cron runs "with retry on failure" — [Functions overview](https://docs.insforge.dev/core-concepts/functions/overview)
- **Custom Compute:**
  - Runs any Docker image (from a registry, or InsForge builds your Dockerfile), and is pitched for "queue workers, background processors, AI inference loops, websocket servers, scrapers".
  - "Each service runs one instance".
  - "There are no persistent volumes yet": redeploys recreate the container.
  - Scale-to-zero is supported on Fly.io.

  — [Compute doc](https://docs.insforge.dev/core-concepts/compute/overview). On cloud it runs on Fly.io — [FAQ](https://docs.insforge.dev/faq). README status: "private preview" — [GitHub README](https://github.com/InsForge/InsForge)
- Compute pricing: Free includes "120h of custom compute on default spec"; on Pro it is "billed by usage" with $10/month compute credit — [Pricing FAQ doc](https://docs.insforge.dev/pricing)
- **Realtime:**
  - A trigger calls `realtime.publish(channel, event, payload)` to push to channels such as `order:<id>`.
  - Clients `subscribe(channel)` and handle events.
  - Subscription RLS comes from `SELECT` policies on `realtime.channels`, which can use `auth.uid()` and `realtime.channel_name()`.
  - Client publish is controlled by `INSERT` policies on `realtime.messages`.
  - Message history with delivery counts is kept, and channel webhook fan-out "retries transient network failures".

  — [Realtime overview](https://docs.insforge.dev/core-concepts/realtime/overview). The SDK connection attempt times out after 10 s — [TS realtime doc](https://docs.insforge.dev/sdks/typescript/realtime). Retention is configurable via `[realtime] retention_days` — [Config-as-code doc](https://docs.insforge.dev/agent-native/config-as-code)
- InsForge's own docs advise putting post-DB-change business logic in an Edge Function invoked from a trigger, and using Realtime for client delivery — [Realtime overview](https://docs.insforge.dev/core-concepts/realtime/overview)
- Release notes mention realtime fixes in July 2026: broadcasts for PATCH/PUT in v2.2.7, coalesced query invalidations in v2.2.8 — [GitHub releases](https://github.com/InsForge/InsForge/releases)

### Inferences
- **Mapping RankSEO's pipeline onto InsForge, without Trigger.dev:**
  1. A Next.js server action or edge function calls the quota/entitlement RPC, inserts `jobs(status='queued')`, and calls the Bright Data trigger API with a webhook URL pointing at an InsForge edge function, including a per-job secret.
  2. The Bright Data webhook hits that edge function. It verifies the request, stores results (in Storage or tables), and updates `jobs.status` and progress.
  3. A trigger on `jobs` calls `realtime.publish('job:'||id, 'progress', …)`. The browser subscribes, with RLS limiting each user to their own jobs.
  4. Claude structured-output calls run in a second short edge function or in a Next.js route, triggered by the status change.
  5. A pg_cron sweeper every minute marks jobs past their deadline (for example 20 min) as failed and refunds quota.

  This is workable and arguably simpler than holding a 15-minute task open. But **all durability is hand-built**: idempotency, retries, dead-lettering, timeouts and observability. Trigger.dev v4 provides these today. The review's "silent pipeline failures" finding is exactly what this design risks reintroducing.
- An LLM call over 30 to 60 s, for example a long structured generation, could exceed the edge-function limit. Plan to run those in Next.js server routes (with Vercel/Railway limits) or in Compute.
- Hosting a durable queue worker (for example a Postgres-backed queue) on Custom Compute is possible. However, it is "private preview", single-instance and without persistent volumes, which is a fragile foundation for a paid product's critical path in October 2026.
- **Keeping Trigger.dev alongside InsForge is also viable.** Tasks write progress rows into InsForge Postgres (via the direct connection string or admin key), and InsForge Realtime fans them out. This drops Trigger.dev's realtime streams but keeps its durability, at the cost of one extra vendor.

### Gaps
- No authoritative current number for the cloud edge-function wall-clock limit, CPU or memory limits, concurrency, or cold-start behaviour.
- No documented realtime limits: concurrent connections, message rate or size, or whether realtime is metered or billed.
- No `waitUntil`/background-task support is documented for edge functions.

## 6. AI/model gateway: which models (Claude?), pricing or markup, structured output, rate limits

### Takeaway
The "Model Gateway" is OpenRouter. InsForge's own proxy routes are now **deprecated**; new code should call OpenRouter's OpenAI-compatible API directly with an OpenRouter key that InsForge provisions and bills. Claude models are reachable through OpenRouter, for example `anthropic/claude-3.5-haiku` in the docs. Tool calling is documented. **Structured output (JSON schema) is not mentioned, and neither is any markup.** Per-project rate limits and spend caps exist, but their values are not published.

### Cited Findings
- The concept page describes an OpenAI-compatible gateway at `https://<project>.insforge.dev/v1` (`/v1/chat/completions`, `/v1/embeddings`, `/v1/models`) routed through OpenRouter. InsForge holds provider keys. "Each project carries its own rate limit and spend cap. Hit it, and the gateway returns a clean 429." "Billing reconciles to OpenRouter's invoice automatically." — [Model Gateway overview](https://docs.insforge.dev/core-concepts/ai/overview)
- **Contradiction.** The TypeScript SDK doc says "InsForge provisions an OpenRouter API key for Model Gateway projects. For new AI features, use that key directly with OpenRouter's OpenAI-compatible API instead of the deprecated InsForge AI proxy methods." It also warns not to expose `OPENROUTER_API_KEY` in browser bundles — [TS AI doc](https://docs.insforge.dev/sdks/typescript/ai). The REST doc says the InsForge AI proxy routes for chat, images and embeddings "are deprecated" — [REST AI doc](https://docs.insforge.dev/sdks/rest/ai)
- The docs show examples for streaming with `anthropic/claude-3.5-haiku`, tool calling (`tools` / `tool_calls`), image input and image generation — [TS AI doc](https://docs.insforge.dev/sdks/typescript/ai)
- `GET /api/ai/models` returns per-model prices, for example `"inputPriceLabel": "$2.50 / 1M tokens"` and `"outputPriceLabel": "$10.00 / 1M tokens"` — [REST AI doc](https://docs.insforge.dev/sdks/rest/ai)
- Included AI credits are **$1 on Free and $10 on Pro**; usage beyond that is billed — [Pricing FAQ doc](https://docs.insforge.dev/pricing). The pricing page says Pro has "AI Model Gateway, billed by usage" and states no markup — [Pricing page](https://insforge.dev/pricing)
- `npx @insforge/cli ai overview` shows usage, limits, remaining credit and per-model spend (CLI v0.2.5, 2026-08-07) — [Changelog](https://insforge.dev/changelogs)
- Billing-relevant fixes: "AI token double-counting fix" in v2.3.2 (2026-09-08); "stale AI credential cache" fix in v2.2.8 (2026-07-23) — [GitHub releases](https://github.com/InsForge/InsForge/releases)
- Independent hands-on test (May 2026): "The gateway needed manual API key entry, then routed between GPT-4o and Claude Sonnet." — [agent-finder review](https://agent-finder.co/reviews/insforge)
- The status page showed **OpenRouter "Degraded Performance"** on 2026-10-12, with no incident listed — [Status page](https://insforge.status.io)
- For self-hosting you supply your own `OPENROUTER_API_KEY` — [Self-host security guide](https://docs.insforge.dev/deployment/deployment-security-guide)

### Inferences
- For RankSEO this adds little over calling Anthropic directly or keeping the Vercel AI Gateway. It mainly moves LLM billing onto the InsForge invoice through OpenRouter, adding OpenRouter as a dependency. Structured output with Claude via OpenRouter depends on OpenRouter's and the model's support, which is not documented by InsForge.
- Nothing in InsForge forces use of its gateway. Direct Anthropic SDK calls from edge functions (Deno `npm:` imports) or Next.js routes remain possible, subject to the edge-function timeout.

### Gaps
- No documented markup over OpenRouter list prices, and no documented OpenRouter fee pass-through.
- No documented default per-project rate-limit or spend-cap values.
- No mention of `response_format` / `json_schema` structured output or prompt caching.

## 7. Maturity: founding, funding, team, GitHub activity, version, production users, status and incidents, security and compliance, regions, backups

### Takeaway
InsForge is very early-stage. It was founded in 2025, joined YC in Spring 2026, and has a 6-person team. It has high GitHub star counts (13.1k) and frequent releases (backend v2.3.3 on 2026-10-06), but the CLI is still 0.x and Compute is in "private preview". There are no named production customers, no public SLA, SOC 2 is "listed" only for Enterprise with no public report, and backups are daily with 7-day retention and no documented point-in-time recovery. As of late September 2026 the company's headline focus appears to be shifting to **InstaCloud**, its new agent-native serverless cloud.

### Cited Findings
- **YC profile.** "InsForge (InstaCloud)", **Spring 2026** batch, **founded 2025**, **team size 6**, San Francisco. Founders: Hang Huang (CEO; ex-Amazon PM, Yale MBA) and Tony Chang (CTO; ex-Databricks). One-liner: "The agent-native serverless cloud" — [YC company page](https://www.ycombinator.com/companies/insforge-instacloud)
- **Funding (sources conflict):**
  - On 2026-09-29 the CEO posted on X that the company raised an **$8M seed for InstaCloud**, with no investors, valuation or traction disclosed. The earlier public financing was a "$1.5 million pre-seed" — [Runtimewire, 2026-09-29](https://runtimewire.com/article/instacloud-8m-seed-agent-cloud)
  - Database profiles disagree, per search-result summaries I did not fetch directly: Dealroom lists a $1.5M seed in July 2025 led by MindWorks Ventures **(possibly stale)**; PitchBook dates a $1.5M seed to 2026-06-04 and $2.2M total; Crunchbase lists a YC-led pre-seed; Tracxn shows "unfunded" (outdated) — [Dealroom](https://app.dealroom.co/companies/insforge); [PitchBook](https://pitchbook.com/profiles/company/932504-32); [Crunchbase](https://www.crunchbase.com/organization/insforge); [Tracxn](https://tracxn.com/d/companies/insforge/__GaPW2wUbnXsSckjq9nXa-S5xkaEpKr0LobM2oUuGVNk)
- **InstaCloud** launched 2026-09-29 as a serverless cloud for coding agents, with scale-to-zero and environment branching — [Runtimewire](https://runtimewire.com/article/instacloud-8m-seed-agent-cloud); [X post by @omarsar0](https://x.com/omarsar0/status/2104977174122156314). Its OSS version is a self-hostable PaaS ("alternative to Railway, Render, Fly, and AWS") with Postgres, buckets, containers, managed Redis/MySQL/MongoDB, approval gates and an audit trail. It has 153 stars, its README gives no explicit maturity label, and the install example pins v0.2.0 — [instacloud-oss README](https://github.com/InsForge/instacloud-oss)
- **GitHub activity (retrieved 2026-10-12):**
  - `InsForge/InsForge` has **13,101 stars**, 1,220 forks and an open-issues+PRs count of 215. It was last pushed 2026-10-11 — [GitHub org via search API](https://github.com/InsForge)
  - The repo has 5,582 commits on main — [GitHub repo](https://github.com/InsForge/InsForge)
  - About 470 issues in total — [GitHub issues](https://github.com/InsForge/InsForge/issues?q=is%3Aissue+sort%3Acomments-desc)
  - The homepage says "over 10,000 GitHub stars" — [insforge.dev](https://insforge.dev)
- **Releases (all 2026).** v2.2.4 (06-29), v2.2.5 (07-04), v2.2.6 (07-05), v2.2.7 (07-21), v2.2.8 (07-23), v2.2.9 (07-28), v2.3.0 (08-07), v2.3.1 (08-12), v2.3.2 (09-08), **v2.3.3 (10-06, latest)**. None are labelled breaking — [GitHub releases](https://github.com/InsForge/InsForge/releases). Recent notes include security hardening: magic-byte MIME validation against stored XSS and constant-time admin login (v2.2.7), and HTTP-extension functions restricted to admins (v2.3.3) — [GitHub releases](https://github.com/InsForge/InsForge/releases)
- **Client versions.** `@insforge/sdk` latest is **1.5.2 (2026-07-31)**, with 190 versions published since 2025-08-30. `@insforge/cli` latest is **0.2.8 (2026-08-17)**, first published 2026-02-20 — [npm registry](https://www.npmjs.com/package/@insforge/sdk); [npm registry CLI](https://www.npmjs.com/package/@insforge/cli)
- **Upgrades** are per project: `npx @insforge/cli projects update-version` "restarts the instance, so expect a brief downtime" — [CLI harness doc](https://docs.insforge.dev/agent-native/cli-harness)
- **Production users.** The homepage shows no customer logos, named testimonials or developer and project counts — [insforge.dev](https://insforge.dev). The Showcase lists community projects such as "National Flags Leaderboard" on a `vercel.app` subdomain — [Showcase](https://docs.insforge.dev/showcase)
- **Status and incidents.** The status page (launched 2026-03-07) covers Website, Cloud Infrastructure in **US-East, US-West, EU-Central and AP-Southeast**, the Deno Edge Network and OpenRouter. On 2026-10-12 it showed "0 incidents in the last 30 days" and no uptime percentages — [Status page](https://insforge.status.io); [Status page launch blog](https://insforge.dev/blog/insforge-status-page)
- **Security and compliance:**
  - The Enterprise plan "lists SOC 2 and a paid HIPAA add-on".
  - InsForge's own agent-facing security page (last_updated 2026-08-12) tells buyers to **confirm before production use**: managed-cloud regions and data residency; "Current SOC 2 report type, scope, period, and availability"; DPA and subprocessors; encryption and key management; "Backup RPO/RTO"; "Availability SLA".

  — [agents.insforge.dev/security.md](https://agents.insforge.dev/security.md). An independent review (May–July 2026) says SOC 2, HIPAA and GDPR data residency are "not available yet" — [agent-finder review](https://agent-finder.co/reviews/insforge). The repo has a SECURITY.md policy — [GitHub repo](https://github.com/InsForge/InsForge)
- **Backups.** Cloud takes a full DB backup daily for active paid projects, with **7-day retention**. Manual backup slots: 1 on Free, 5 on paid. "Backups cover the database only — files uploaded to Storage are not included." A restore takes the project offline and cannot be undone. Self-hosted scheduled backups are supported — [Backups doc](https://docs.insforge.dev/core-concepts/database/backups). PITR is not documented — [llms-full.txt](https://docs.insforge.dev/llms-full.txt)
- **Notable open issues (2026):**
  - #1790: branch state reports "ready" before the data plane serves; a failed branch create can leave one running
  - #1558: `system.database_backups` not selectable by project_admin
  - #1701: self-hosted env vars with size units silently truncated
  - #1367: Create Table form data lost on refresh

  — [GitHub issues](https://github.com/InsForge/InsForge/issues?q=is%3Aissue+sort%3Acomments-desc)

### Inferences
- The star count is not a usage measure. npm downloads (about 74k SDK per month) and the absence of named customers suggest a real but mostly hobby- and prototype-heavy user base.
- The rebrand of the YC listing to "InsForge (InstaCloud)", the $8M round being "for InstaCloud", and the fact that SDK and CLI npm publishes stopped after July and August 2026 while `instacloud-cli` is being pushed daily together suggest engineering focus is moving to InstaCloud. That is a roadmap risk for a team betting its SaaS on the InsForge BaaS. This is inference, not confirmed; the backend repo is still actively released.
- Daily backups with 7-day retention, no PITR, Storage excluded and a non-public SLA fall below what a paid SaaS normally wants as its single source of truth. Plan independent `pg_dump`s, for example a nightly job to your own S3.

### Gaps
- Headcount beyond the YC page's "6", revenue and customer counts: not found.
- Whether a SOC 2 Type I or II report actually exists: not found. The pricing page "lists" SOC2 for Enterprise only.
- Historical incident record before the status page launched in March 2026, and any uptime numbers.

## 8. Pricing tiers and limits; the self-hosting option and its operational burden

### Takeaway
Pro is $25/month month-to-month, or $20/month billed yearly. On top of that, every project needs a dedicated backend instance billed hourly, from $5/month (Nano). Usage overages are cheap. Free projects pause after a week of inactivity. Self-hosting the full stack is possible and Apache-2.0, but you then own SMTP, the OpenRouter key, S3, compute (your own Fly.io account or Docker socket), TLS, backups and upgrades. CLI+Skills is cloud-only.

### Cited Findings
- **Free ($0):** 50,000 MAU; 500 MB database; 5 GB bandwidth; 1 GB storage; 100,000 edge function calls; 600 min site builds; 120 h custom compute; "Free projects are paused after 1 week of inactivity" — [Pricing page](https://insforge.dev/pricing). Free orgs over their limits stay paused until upgrade. A paused project can be restored for 30 days, after which it is archived with backup and files downloadable — [FAQ](https://docs.insforge.dev/faq)
- **Pro:** "$20/month… Billed yearly at $240 — or $25 month-to-month", including $10 InsForge Compute credits.
  - 100,000 MAU, then $0.00325/MAU
  - 8 GB DB, then $0.125/GB
  - 250 GB bandwidth, then $0.09/GB
  - 100 GB storage, then $0.021/GB
  - **100,000 edge function calls, then $0.01 per 1,000** (the same allowance as Free)
  - Unlimited site builds
  - Custom compute and AI gateway billed by usage

  — [Pricing page](https://insforge.dev/pricing). The docs' copy of the pricing table says "$25 / mo" and adds AI model credits of $1 (Free) and $10 (Pro) — [Pricing FAQ doc](https://docs.insforge.dev/pricing)
- **Enterprise (custom):** SOC2, HIPAA add-on, SSO, unlimited projects, dedicated support — [Pricing page](https://insforge.dev/pricing)
- **Per-project instance** ("Every project runs on its own dedicated server… the API server and its Postgres database"), billed hourly. Monthly prices: Nano $5 (0.5 GB), Micro $10 (1 GB), Small $20 (2 GB), Medium $40 (4 GB), Large $80 (8 GB), XL $160, and up to 16XL $2,560. The $10 compute credit is "applied once per organization across all projects". The pricing page states no spend cap or project limits for Free or Pro — [Pricing page](https://insforge.dev/pricing)
- **Team access** is org-level only, with Administrator and Developer roles and "no separate 'share just this one project' flow" — [FAQ](https://docs.insforge.dev/faq)
- **Self-hosting:**
  - Docker Compose v2, a setup script, then edit `.env` and run `docker compose up -d` — [GitHub README](https://github.com/InsForge/InsForge)
  - Guides exist for AWS EC2, GCP, Azure, Hetzner, Coolify, Dokploy and Containarium. The cloud walkthroughs are "community-maintained and can lag the latest InsForge release" — [docs index](https://docs.insforge.dev/llms.txt); [llms-full.txt](https://docs.insforge.dev/llms-full.txt)
  - Ports 5432, 5430 and 7133 must not be exposed; put Nginx or Caddy in front — [Hetzner guide](https://docs.insforge.dev/deployment/deploy-to-hetzner)
  - Self-hosted instances must configure Custom SMTP before any email (including verification) is sent — [Custom SMTP doc](https://docs.insforge.dev/core-concepts/messaging/custom-smtp)
  - Compute needs your own Fly.io token and org, or a mounted Docker socket — [FAQ](https://docs.insforge.dev/faq); [Compute doc](https://docs.insforge.dev/core-concepts/compute/overview)
  - InsForge's security page says the self-hosting operator "owns hardening, availability, backups, upgrades, and incident response" — [agents.insforge.dev/security.md](https://agents.insforge.dev/security.md)
- A third-party review lists Free as "unlimited auth users… 500K edge invocations/month" (May 2026). This **contradicts** the current pricing page and is likely stale or inaccurate — [agent-finder review](https://agent-finder.co/reviews/insforge)

### Inferences
- **Rough cost for RankSEO's production project (inference).** Pro at $25, plus a Small or Medium instance at $20–40, minus the $10 credit, comes to about **$35–55/month** before AI and Bright Data. Edge-function overages would be negligible (1M extra calls is $10). A staging branch or second project adds another instance fee.
- The free tier's one-week pause makes it unsuitable for always-on staging.

### Gaps
- Realtime connection and message pricing or limits: not on the pricing page.
- Which instance size a new Pro project gets by default: not stated.
- Self-hosting minimum resources for the InsForge BaaS stack: not stated. The instacloud-oss README gives 2 vCPU / 2 GiB / 15 GiB for InstaCloud, which is a different product.

## 9. Lock-in and exit: is the data plain Postgres you can pg_dump, and how proprietary are the SDK and APIs?

### Takeaway
Exit risk on the data is low. It is plain Postgres 15 with a direct `postgres`-role connection string (Prisma and Drizzle can connect), `pg_dump` and `pg_restore` work, and the whole platform is Apache-2.0 and self-hostable. Lock-in sits in the InsForge-specific layers: the `@insforge/sdk` query and auth client, the `payments.*` mirror and triggers, `realtime.publish`/`realtime.channels`, the `schedules.*` wrapper, InsForge-format `auth.users`, Deno edge functions, and Vercel-hosted Sites.

### Cited Findings
- "Every cloud project has a direct Postgres connection string, handy for `psql`, a database GUI, an ORM (Prisma, Drizzle), or an external service like Better Auth" (`postgresql://postgres:<password>@<appkey>.<region>.database.insforge.app:5432/insforge?sslmode=require`). Standard `pg_dump`, `pg_restore` and `psql` work, and the role bypasses RLS — [FAQ](https://docs.insforge.dev/faq)
- Self-hosted backups can use `docker compose exec postgres pg_dump …` — [Hetzner guide](https://docs.insforge.dev/deployment/deploy-to-hetzner)
- License Apache-2.0 across the core repo, SDKs, CLI and MCP — [GitHub org listing](https://github.com/InsForge)
- An inbound migration tool, `supabase-to-insforge`, covers auth, database and storage "with bcrypt password preservation". It was last pushed 2025-10-15 **(possibly stale)** — [GitHub](https://github.com/InsForge/supabase-to-insforge). I found no outbound or export tool.
- InsForge-specific schemas and APIs:
  - `payments.*` tables and the `webhook_events` triggers — [Payments overview](https://docs.insforge.dev/core-concepts/payments/overview)
  - `realtime.publish()`, `realtime.channels` and `realtime.messages` — [Realtime overview](https://docs.insforge.dev/core-concepts/realtime/overview)
  - `schedules.create_job()` — [Schedules doc](https://docs.insforge.dev/core-concepts/functions/schedules)
  - the `auth` schema — [Auth overview](https://docs.insforge.dev/core-concepts/authentication/overview)
  - the `system.custom_migrations` history table — [Migrations doc](https://docs.insforge.dev/core-concepts/database/migrations)
- Raw restores do not get InsForge's `anon`/`authenticated` grants or RLS automatically — [FAQ](https://docs.insforge.dev/faq)
- **Sites:** "There's currently no self-serve way to take down a deployed Site". Deleting the project "does *not* remove" it, because sites are hosted externally on Vercel — [FAQ](https://docs.insforge.dev/faq); [Sites doc](https://docs.insforge.dev/core-concepts/sites/overview)
- **Better Auth path:** user data lives in `better_auth.*` tables in your Postgres, so InsForge holds no identity state — [Better Auth integration](https://docs.insforge.dev/integrations/better-auth)

### Inferences
- **To keep exit cheap:**
  - Use Better Auth (identity stays portable).
  - Keep billing state in app-owned tables (Stripe stays the source of truth).
  - Write business logic as plain SQL functions plus Next.js server code, not InsForge triggers on `payments.*`.
  - Isolate realtime behind a small adapter.
  - Host Next.js yourself rather than on InsForge Sites.
- **Moving off InsForge would mean** a pg_dump to any Postgres (Neon, Supabase, RDS, Railway), rewriting SDK calls to Prisma or Drizzle, and replacing realtime and cron, roughly days of work for an app of RankSEO's size. Self-hosting InsForge is the zero-rewrite fallback if the company falters.

### Gaps
- The `auth.users` password-hash format and any documented export path for native InsForge users.
- Whether custom-domain or Vercel-project transfer is possible for Sites on exit.

## 10. Community sentiment: Reddit, Hacker News, X, YouTube reviews

### Takeaway
Independent discussion is sparse. There is a small Show HN thread, a handful of review and tutorial sites (several affiliated or repeating vendor numbers), and influencer posts on X. I found no Reddit threads. Recurring themes: a smooth getting-started experience; "it's just Postgres, don't hype it"; thin docs and community compared with Supabase; compliance immaturity; and the free-tier pause.

### Cited Findings
- **Show HN, "InsForge, Open-source Heroku for coding agents"** (by founder mrcoldbrew; shown as "4 months ago", so about June 2026): 62 points and 7 comments.
  - peggyrayzis: "the getting started experience was really smooth".
  - usernametaken29: "It's not an agentic database. It's postgres… which is fine but really no need to hype it up."
  - eddy-sekorti suggested adding a trust/security page.

  — [Show HN](https://news.ycombinator.com/item?id=48181342)
- **agent-finder.co review, 7/10** (2026-05-21, updated 2026-07-08; AI-assisted draft edited by a human; "No affiliate relationship for this product"):
  - Tested for 10 days with Cursor; setup took under 3 minutes.
  - The agent set storage permissions too broadly once.
  - Cold starts were under 200 ms.
  - "Documentation and community are thin compared to Supabase or Firebase"; "Enterprise-grade compliance and scale features are still maturing".
  - "We haven't tested InsForge at production scale."

  — [agent-finder review](https://agent-finder.co/reviews/insforge)
- linkstartai.com says Reddit and creator reviews repeatedly mention free projects pausing after one week of inactivity. This is a secondhand claim, and I could not find the Reddit posts — [LinkStartAI review](https://www.linkstartai.com/en/agents/insforge)
- trend-hunt.com calls it worth attention but notes a much smaller ecosystem than Supabase. It cites the vendor benchmark — [trend-hunt](https://trend-hunt.com/en/product/insforge)
- AlternativeTo has no user reviews — [AlternativeTo](https://alternativeto.net/software/insforge/about)
- Sealos tutorials (March 2026) build a full-stack app with Claude Code and InsForge deployed on Sealos. These are partner-ish, since Sealos hosts InsForge — [Sealos tutorial](https://sealos.io/blog/build-fullstack-app-claude-code-insforge/)
- X: an influencer post (@omarsar0, about 2026-09-29) praises InstaCloud's scale-to-zero and branching "for agent workflows" — [X post](https://x.com/omarsar0/status/2104977174122156314)
- YouTube: no independent video reviews were found in my searches. Video listings mention tutorials, but I could not verify their quality or view counts — [search via Sealos/InsForge blogs](https://insforge.dev/blog/best-backend-for-claude-code-2026)
- GitHub issue themes: self-hosting configuration paper cuts (#1701), auth email edge cases (#1215), branching state bugs (#1790), and feature requests for anonymous sign-in, Paystack and messaging — [GitHub issues](https://github.com/InsForge/InsForge/issues?q=is%3Aissue+sort%3Acomments-desc)

### Inferences
- Sentiment is cautiously positive on developer experience but rests on very little production-scale evidence. Much of the visible praise is vendor or partner content or AI-assisted reviews.

### Gaps
- No Reddit threads were found with WebSearch. A direct Reddit search (r/ClaudeAI, r/vibecoding, r/Supabase) was not possible with my tools.
- No independent production post-mortems or long-term user reports.

## 11. Candid fit assessment against RankSEO's rebuild needs

### Takeaway
InsForge fits well for the database, realtime and agent-workflow half of RankSEO. It offers transactional Postgres with RLS and RPC, realtime progress via triggers, a solid Claude Code CLI/MCP workflow, cheap and fairly predictable pricing, and low data lock-in. It fits **poorly for the critical-path durability half**: it has no durable jobs, queues or retries, short function timeouts, no CAPTCHA, and undocumented auth rate limits. It is also **immature as a sole foundation**: a 6-person, 2025-founded YC company, the CLI at 0.x, Compute in private preview, no SLA or public SOC 2 report, 7-day backups, and an apparent strategic shift to InstaCloud. At best it is a "Postgres + realtime + auth host" paired with Better Auth and a durable job runner, not a one-vendor replacement for the current stack.

### Cited Findings
- Transactional Postgres 15, PostgREST RPC, RLS on by default, and a direct connection string for ORMs — [Database overview](https://docs.insforge.dev/core-concepts/database/overview); [FAQ](https://docs.insforge.dev/faq)
- Email verification is configurable; no CAPTCHA is documented; throttling is a vendor claim with no numbers — [Config-as-code doc](https://docs.insforge.dev/agent-native/config-as-code); [llms-full.txt](https://docs.insforge.dev/llms-full.txt); [Auth overview](https://docs.insforge.dev/core-concepts/authentication/overview)
- Better Auth is officially supported via the bridge route and the `better_auth` schema — [Better Auth integration](https://docs.insforge.dev/integrations/better-auth)
- Stripe checkout, portal and webhook mirroring exist; entitlements and quotas are DIY via triggers and app tables — [Stripe Payments doc](https://docs.insforge.dev/core-concepts/payments/stripe)
- Edge functions are short-lived; cron has a 1-minute minimum and does not retry; Compute is private preview, single-instance and without volumes — [Functions overview](https://docs.insforge.dev/core-concepts/functions/overview); [Schedules doc](https://docs.insforge.dev/core-concepts/functions/schedules); [Compute doc](https://docs.insforge.dev/core-concepts/compute/overview); [GitHub README](https://github.com/InsForge/InsForge)
- Realtime via `realtime.publish()` from triggers, with RLS-guarded channels — [Realtime overview](https://docs.insforge.dev/core-concepts/realtime/overview)
- The AI gateway is OpenRouter, the proxy is deprecated, and structured output is undocumented — [TS AI doc](https://docs.insforge.dev/sdks/typescript/ai)
- Team of 6, YC Spring 2026; InstaCloud seed claim of 2026-09-29 — [YC page](https://www.ycombinator.com/companies/insforge-instacloud); [Runtimewire](https://runtimewire.com/article/instacloud-8m-seed-agent-cloud)
- The security page lists SOC 2 report, SLA, RPO/RTO and data residency as "confirm before production use" — [agents.insforge.dev/security.md](https://agents.insforge.dev/security.md)

### Inferences
- **Requirement-by-requirement verdict:**

  | RankSEO need | InsForge fit | Notes |
  |---|---|---|
  | Auth with email verification | Good | Native, code or link; or use Better Auth via the bridge |
  | Rate limiting / CAPTCHA | Weak | Not native or documented; rely on Better Auth plugins or an edge/WAF layer |
  | Stripe subscriptions | Good | Checkout, portal and webhook ledger are built in |
  | Atomic per-period quotas, server-side entitlements | Good (DIY) | Possible in Postgres via RPC + RLS, but you write and test it; no primitive |
  | Transactional DB | Good | Plain Postgres 15 |
  | Durable jobs waiting about 15 min on Bright Data webhooks | **Poor** | No queue, workflow, retries or wait primitive; hand-build a Postgres state machine, or keep Trigger.dev |
  | Realtime progress to browser | Good | Trigger → `realtime.publish` → WebSocket with RLS |
  | Claude calls | Neutral | Only via OpenRouter; calling Anthropic directly is equally easy |
  | Simple hosting and ops | Mixed | Managed cloud is easy; but upgrades cause brief downtime, there are 7-day backups and no PITR, and Sites run on Vercel with no self-serve takedown |
  | Predictable cost | Good | About $35–55/month base plus usage |
  | Low lock-in | Good for data, moderate for code | Apache-2.0, pg_dump, self-host fallback |
  | Production maturity | **Weak** | Very young company, preview components, no SLA or public SOC 2 report |
  | AI-coding-agent fit | Strong | CLI `--json`, Skills, remote MCP for Claude Code, branching, advisor; vendor-only benchmarks |

- **Vendor-count goal.** InsForge would replace MongoDB/Prisma and potentially Trigger.dev's realtime. But making the pipeline durable without Trigger.dev means rebuilding the very reliability features whose absence caused the "silent pipeline failures" finding. Keeping Trigger.dev keeps three vendors in the critical path: InsForge (plus its OpenRouter, Deno and AWS sub-dependencies), Trigger.dev and Bright Data.
- **If chosen, the lowest-risk configuration is:**
  - InsForge Cloud Pro as the Postgres + realtime host
  - Better Auth (bridge) for identity, verification, rate limit and captcha
  - Stripe via either InsForge Payments or Better Auth's Stripe plugin, but not both
  - Quotas and entitlements as SQL functions with tests run on a branch
  - Trigger.dev (or a proven queue) for the Bright Data wait loop, writing progress rows that InsForge Realtime streams
  - Claude called directly or via the existing gateway
  - Next.js hosted outside InsForge Sites
  - Nightly independent `pg_dump`s
- **Compared with "Better Auth + Railway Postgres + a job runner"** (the alternative implied by this research folder), InsForge's distinctive gains are the agent tooling (branching, advisor, config-as-code), turnkey realtime and Stripe mirroring. Its main costs are maturity risk and the InstaCloud pivot risk.

### Gaps
- No hands-on test was performed. Edge-function timeout, realtime limits and auth throttling values should be measured in a trial project before committing.
- Whether InsForge Payments works with Better Auth-bridged JWTs is unverified.
- The company's roadmap commitment to the InsForge BaaS after the InstaCloud launch is unknown. Asking the founders directly, for example via Discord, would resolve it.
