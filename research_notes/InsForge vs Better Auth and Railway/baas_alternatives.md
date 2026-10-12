# Mature BaaS alternatives to InsForge for rebuilding RankSEO: Supabase and Convex in depth; Appwrite, Nhost and Firebase briefly; evidence on BaaS vs a composed stack (state as of October 2026)

_Conventions: "fetched 2026-10-12" means I read the primary page on that date. Most vendor docs pages carry no date of their own. Items dated before about October 2025 are tagged **[>12 mo, possibly stale]**. "Vendor" means vendor-authored docs or marketing. "Independent" means a third party. "Search-derived" means the claim comes from a search-engine summary of the cited page rather than my own full read, so it should be verified before anyone relies on it._

## Supabase (Oct 2026): auth, Postgres + RLS, Edge Functions limits, Queues, Cron, Realtime, Stripe, AI/vector, pricing and spend caps, MCP, self-hosting and lock-in, maturity and incidents

### Takeaway
Supabase is the most mature option here and has the lowest data lock-in. It is plain Postgres, raised at a $10.5B valuation in June 2026, and reports more than 9M developers. It covers every RankSEO need except durable long-running compute: auth with CAPTCHA and configurable rate limits, Stripe data sync, Realtime Broadcast, pgmq Queues, Cron, and the most complete official BaaS MCP server. Edge Functions must answer within 150 s and stop at 400 s wall-clock on paid plans, with 2 s of CPU per request. The 15-minute Bright Data wait therefore has to be built as an event-driven state machine (webhook → queue → short worker invocations). It cannot be a single job, and Supabase has no first-party durable-workflow engine.

### Cited Findings

#### Auth
- Supabase Auth supports hCaptcha and Cloudflare Turnstile on the sign-in, sign-up and password-reset forms. It is enabled under Settings > Authentication > Bot and Abuse Protection, and the client passes `options: { captchaToken }`. The page does not say whether anonymous sign-ins are covered. — [Supabase docs: Auth CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) (fetched 2026-10-12)
- Default Auth rate limits, all configurable in Dashboard > Authentication > Rate Limits or through the Management API `rate_limit_*` fields:
  - The built-in email provider allows only "2 emails per hour". Raising that needs custom SMTP or a Send Email hook.
  - Sign-up/sign-in endpoints (`/signup`, `/recover`, `/resend`, `/magiclink`, `/otp`, `/user`): 30 requests per 5 min per IP.
  - OTP/magic link, signup confirmation and password reset: a 60 s window per user.
  - `/verify`: 30 per 5 min per IP.
  - `/token`: 150 per 5 min per IP.
  - Anonymous sign-ins: 30/hour per IP.
  - MFA challenge/verify: 15/min per IP, and this one is not configurable.
  — [Supabase docs: Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) (fetched 2026-10-12)
- MAU allowances: Free includes 50,000 MAU and Pro/Team 100,000. Overage is $0.00325 per MAU. — [Supabase pricing](https://supabase.com/pricing) (fetched 2026-10-12)

#### Postgres + RLS (and security footguns)
- An HN thread titled "Your Supabase is public if you turn off RLS" (2025-12-22, 112 pts) was disputed in its own comments. Commenters said RLS is on by default for new tables, that a table with RLS on and no policy returns nothing, and that the dashboard warns loudly when RLS is off. — [HN thread](https://news.ycombinator.com/item?id=46355345); [article](https://skilldeliver.com/your-supabase-is-public)
- A January 2026 report was titled "11% of vibe-coded apps are leaking Supabase keys" (HN, 2026-01-17, 53 pts). I read only the title, not the methodology. — [HN](https://news.ycombinator.com/item?id=46662304); [report](https://supaexplorer.com/cybersecurity-insight-report-january-2026)
- A practitioner wrote that their team "had to gut it out" of a Next.js app in a "multi-week refactoring effort". Their reason: "once you want to start doing more complicated stuff, a lot of the RLS primitives become very hard to maintain and test… Supabase strongly pushes you in that direction" (2025-04-22). **[>12 mo, possibly stale]** — [HN comment by atonse](https://news.ycombinator.com/item?id=43763733)

#### Edge Functions limits (the binding constraint for RankSEO)
- Current limits:
  - Memory: 256 MB.
  - Wall-clock duration: **Free 150 s, paid plans 400 s**.
  - CPU time: **2 s per request**, counting "actual CPU time and excludes async I/O".
  - Request idle timeout: **150 s**, after which the platform returns a 504.
  - Bundle size: 20 MB via CLI, 5 MB server-side.
  - Functions per project: Free 100, Pro 1,000, Team 2,000.
  - Outbound ports 25 and 587 are blocked.
  - The Web Worker API and Node `vm` are unavailable, and multithreaded native libraries such as sharp are unsupported.
  — [Supabase docs: Edge Function limits](https://supabase.com/docs/guides/functions/limits) (fetched 2026-10-12)
- Background tasks use `EdgeRuntime.waitUntil(promise)`, but the function still shuts down when it reaches the limits. Local dev kills background tasks unless `policy = "per_worker"` is set. — [Supabase docs: Background tasks](https://supabase.com/docs/guides/functions/background-tasks) (search-derived)
- An isolate can be retired early once the response is sent with no pending `waitUntil`. An open `waitUntil` "does not extend the hard wall clock limit." — [Supabase troubleshooting: shutdown reasons](https://supabase.com/docs/guides/troubleshooting/edge-function-shutdown-reasons-explained) (search-derived)
- In a November 2025 thread, a user had GPT-5 calls running past 5 minutes. A Supabase collaborator answered "No you can't increase it" and "Both Free and Pro are 150 seconds to respond to the initial request." Background work can run up to 400 s, but only on Pro. A queue plus background function "only buys your more time on Pro". For anything longer, the suggested pattern is an async external API (submit, store the ID, fetch later). (2025-11-03/05) — [GitHub Discussion #40074](https://github.com/orgs/supabase/discussions/40074)
- A community feature request asks for more Edge Function CPU time, even if billed. A participant said outgrowing the CPU limits forces a move away from Supabase. The date was not verified. — [GitHub Discussion #36678](https://github.com/orgs/supabase/discussions/36678) (search-derived)
- A community thread is titled "A maximum timeout of 5000ms when calling an edge function through the `pg_cron` extension?". I did not read it, so the default HTTP-timeout gotcha it suggests is unverified. — [GitHub Discussion #37574](https://github.com/orgs/supabase/discussions/37574)

#### Queues, Cron, durable workflows
- Supabase Queues is built on `pgmq`. The docs describe it as "a Postgres-native durable Message Queue system with guaranteed delivery", where "A Message is delivered exactly once to a consumer within a customizable visibility window". Messages can be archived, and client access is controlled with API permissions and RLS. The page does not state limits, pricing or GA status. — [Supabase docs: Queues](https://supabase.com/docs/guides/queues) (fetched 2026-10-12)
- Supabase Cron is pg_cron. Jobs run "from every second to once a year" and can be SQL, database functions or HTTP requests, such as invoking an Edge Function. The docs recommend "no more than 8 Jobs run concurrently" and "Each Job should run no more than 10 minutes". Runs are logged in `cron.job_run_details`. — [Supabase docs: Cron](https://supabase.com/docs/guides/cron) (fetched 2026-10-12)
- No first-party durable-workflow product turned up:
  - The official durable-workflow content is a DBOS integration post from December 2024. **[>12 mo, possibly stale]** — [Supabase blog: Durable workflows in Postgres using DBOS](https://supabase.com/blog/durable-workflows-in-postgres-dbos)
  - A third party (Resonate, July 2026) published a SQL file that turns a stock Supabase project into a durable-execution engine, using Edge Functions as workers. — [Resonate journal](https://journal.resonatehq.io/p/durable-workflows-and-durable-ai)
  - This is a negative finding from my searches, so confirm it against the changelog.

#### Realtime (progress streaming)
- Postgres Changes has two documented caveats:
  - It "authorizes every event against each subscriber". Changes "are processed on a single thread to preserve their order, which means larger compute add-ons don't meaningfully increase Postgres Changes throughput."
  - Above about 3,000 concurrent subscribers, the page says to use Broadcast instead.
  - Example throughput: Micro with RLS and 500 clients reaches about 3,000 msgs/s; Micro without RLS reaches about 32,000 msgs/s.
  — [Supabase docs: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) (fetched 2026-10-12)
- Broadcast from the database:
  - `realtime.send()` publishes free-form messages, and the `realtime.broadcast_changes()` trigger function publishes row changes.
  - Servers can also POST to `/realtime/v1/api/broadcast/{topic}/events/{event}`, which has a batch endpoint.
  - Private channels use Realtime Authorization through RLS policies on `realtime.messages`.
  - Database-sent messages are kept "at least 72 hours and at most 4 days". Replay is capped at 25 messages and works only on private channels.
  — [Supabase docs: Broadcast](https://supabase.com/docs/guides/realtime/broadcast) (fetched 2026-10-12)
- Realtime pricing:
  - Free: 2M messages/month and 200 peak connections.
  - Pro: 5M messages and 500 peak connections.
  - Overage: $2.50 per million messages and $10 per 1,000 peak connections.
  — [Supabase pricing](https://supabase.com/pricing) (fetched 2026-10-12)

#### Stripe integration
- One-click "Stripe Sync Engine" launched on 2025-12-19 in Dashboard > Integrations.
  - It needs a restricted Stripe key.
  - It backfills through concurrent Edge Functions, with retries on failures and rate limits.
  - Webhooks keep data current, with scheduled backfills for history.
  - Stripe engineers contributed incremental sync, JSONB with generated columns, and multi-account (Connect) support.
  — [Supabase blog (2025-12-19)](https://supabase.com/blog/stripe-sync-engine-integration) (search-derived)
- On 2026-04-14 the engine moved from `supabase/stripe-sync-engine` to `stripe/sync-engine`. It "stays open source under the Apache 2.0 license", and "The one-click integration in the Supabase dashboard continues to work as before." — [Supabase blog: Stripe Sync Engine transfer](https://supabase.com/blog/stripe-sync-engine-transfer) (fetched 2026-10-12)

#### AI / vector
- The AI toolkit includes:
  - A pgvector vector store.
  - Semantic, keyword and hybrid search.
  - Embedding generation with open-source models inside Edge Functions.
  - Integrations with OpenAI, Hugging Face, LangChain, LlamaIndex and Amazon Bedrock.
  The page gives no limits or dates. — [Supabase docs: AI & Vectors](https://supabase.com/docs/guides/ai) (fetched 2026-10-12)
- "Analytics and vector buckets" and ETL exist on the hosted platform but are listed as unavailable when self-hosting. — [Supabase docs: Self-hosting](https://supabase.com/docs/guides/self-hosting) (fetched 2026-10-12)

#### Pricing and spend caps
- Free tier:
  - $0.
  - Two active projects.
  - Projects pause after 1 week of inactivity.
  - 500 MB database, 5 GB egress, 1 GB storage.
  - 500k Edge Function invocations.
  — [Supabase pricing](https://supabase.com/pricing) (fetched 2026-10-12)
- Pro tier:
  - From $25/month.
  - 8 GB database per project, 250 GB egress, 100 GB storage.
  - 2M Edge Function invocations, then $2 per extra million.
  - Database overage: $0.125/GB.
  - Egress overage: $0.09/GB.
  — [Supabase pricing](https://supabase.com/pricing) (fetched 2026-10-12)
- Team tier: from $599/month. — [Supabase pricing](https://supabase.com/pricing) (fetched 2026-10-12)
- Compute:
  - Compute is billed hourly, per project, separately from the plan.
  - Pro and Team include $10/month of compute credits, which covers one Micro instance.
  - Micro costs $10/month, and the page's example puts a Pro org with two Micro projects at $35/month.
  — [Supabase pricing](https://supabase.com/pricing) (fetched 2026-10-12)
- The Spend Cap is Pro-only and on by default.
  - It covers usage items such as disk size, egress, Edge Function invocations, MAU, Realtime and storage.
  - It **excludes** compute, branching compute, read-replica compute, custom domains, extra IOPS/throughput, IPv4, log drains, MFA Phone and PITR.
  - When it is hit, "further usage of that item is disallowed until the next billing cycle". Services can be restricted under fair use if you consistently exceed quota.
  - It is not a notification feature.
  — [Supabase docs: Cost control](https://supabase.com/docs/guides/platform/cost-control) (fetched 2026-10-12)

#### Official MCP server
- Endpoint and access:
  - The hosted endpoint is `https://mcp.supabase.com/mcp`.
  - Authentication defaults to OAuth with dynamic client registration. A scoped PAT is used for CI.
  - The listed clients include Claude Code, Codex, Gemini CLI, Cursor, VS Code, Claude.ai and ChatGPT.
  — [Supabase docs: MCP](https://supabase.com/docs/guides/getting-started/mcp) (fetched 2026-10-12; the page links the MCP spec revision 2026-07-28)
- Tool groups:
  - **Database:** `list_tables`, `list_extensions`, `list_migrations`, `apply_migration`, `execute_sql`.
  - **Debugging:** `query_logs`, `get_advisors`.
  - **Development:** `get_project_url`, `get_publishable_keys`, `generate_typescript_types`.
  - **Edge Functions:** `list_edge_functions`, `get_edge_function`, `deploy_edge_function`, `create_edge_function_secret`.
  - **Account:** `create_project`, `pause_project`, `get_cost`, `confirm_cost` and others.
  - **Docs:** `search_docs`.
  - **Branching** (experimental, paid): `create_branch`, `merge_branch`, `rebase_branch` and others.
  - **Storage:** disabled by default.
  All other groups are on by default. — [Supabase docs: MCP](https://supabase.com/docs/guides/getting-started/mcp) (fetched 2026-10-12)
- Safety guidance:
  - Keep manual approval of tool calls on.
  - Give unattended routines only project-scoped, read-only tools. Read-only mode runs SQL as a read-only Postgres user.
  - Use a development branch to test changes.
  - Production projects "can contain sensitive data".
  — [Supabase docs: MCP](https://supabase.com/docs/guides/getting-started/mcp) (fetched 2026-10-12)
- Configuration and local use:
  - `read_only=true` and `project_ref=` are set as URL parameters.
  - Local CLI and self-hosted deployments get "a limited tool subset and no OAuth 2.1".
  - The local stack serves MCP at `http://localhost:54321/mcp`.
  — [supabase-mcp README](https://github.com/supabase-community/supabase-mcp); [Supabase docs: MCP](https://supabase.com/docs/guides/getting-started/mcp)
- Security history:
  - General Analysis's post "Supabase MCP can leak your entire SQL database" (HN 2025-07-08, 848 pts, 470 comments) showed prompt injection through support-ticket content to an agent running with `service_role`. — [HN](https://news.ycombinator.com/item?id=44502318); [General Analysis](https://www.generalanalysis.com/blog/supabase-mcp-blog)
  - Simon Willison called it the "lethal trifecta" (2025-07-06). — [Simon Willison](https://simonwillison.net/2025/Jul/6/supabase-mcp-lethal-trifecta/)
  - Supabase replied (about September 2025) that RLS stays enforced and no customer leak had been reported. It added read-only, project-scoped and feature-group restrictions, while still calling prompt injection the main concern. — [Supabase blog: Defense in depth for MCP](https://supabase.com/blog/defense-in-depth-mcp) (search-derived)
  - **[>12 mo, possibly stale]** for the incident itself; the mitigations are reflected in the current docs above.

#### Self-hosting and lock-in
- Docker Compose is "the fastest and recommended way to self-host Supabase". Kubernetes support is community-maintained, and the CLI stack "must not be exposed to external traffic". — [Supabase docs: Self-hosting](https://supabase.com/docs/guides/self-hosting) (fetched 2026-10-12)
- Self-hosted Studio supports a single project only. The self-hosting docs say these are unavailable when self-hosting:
  - Branching.
  - Advanced metrics.
  - Managed backups and PITR.
  - Analytics and vector buckets.
  - ETL.
  - The Management API.
  — [Supabase docs: Self-hosting](https://supabase.com/docs/guides/self-hosting) (fetched 2026-10-12)
- Support and operations: self-hosting "is community-supported". The operator owns hardening, high availability, backups and disaster recovery, and monitoring. — [Supabase docs: Self-hosting](https://supabase.com/docs/guides/self-hosting) (fetched 2026-10-12)

#### Maturity, company, incidents, support
- Funding:
  - $500M Series F at a $10.5B valuation (June 2026), led by GIC.
  - Stripe made a second investment, and Salesforce Ventures joined.
  - The company cites more than 9M developers.
  — [Orrick (counsel) announcement, June 2026](https://www.orrick.com/en/News/2026/06/Supabase-Raises-500-Million-at-10-5-Billion-Valuation-to-Accelerate-Lead-in-Agentic-Infrastructure)
  - Prior rounds were a Series E at $5B (October 2025) and a Series D at $2B. — [DefiLlama](https://defillama.com/pre-ipo/supabase); [HN on the Series D, 2025-04-22](https://news.ycombinator.com/item?id=43763225)
  - Sacra (independent estimate) puts ARR at about $170M in May 2026, up from about $101M at the end of 2025. — [Sacra](https://sacra.com/c/supabase/)
- On 2026-10-02 Supabase announced it is acquiring Turso (Rust SQLite).
  - Glauber Costa will lead an "agentic infrastructure" effort.
  - "Nothing changes for existing users"
  - Supabase "will continue building around Postgres".
  - It also says it launches more than 1M databases per week.
  — [Supabase blog](https://supabase.com/blog/supabase-is-acquiring-turso); [HN (221 pts)](https://news.ycombinator.com/item?id=49934784)
- Recent incidents, from third-party mirrors of the status page (not verified against status.supabase.com):
  - 2026-09-24: a Dashboard permissions bug (about 1h15m), and a hardware failure in eu-west-1 (about 2h05m).
  - 2026-09-28: delayed log ingestion (51 min).
  - 2026-03-03: a database error spike in us-east-2 (about 4h20m).
  - 2026-02-26: a Supavisor connectivity problem in EU-Central-1 (about 1h).
  - 2026-06-17: a compute failure in us-east-2 (about 1h50m).
  - Pingoru's aggregate downtime figures are internally inconsistent.
  — [UptimeRobot 2026-09-24](https://uptimerobot.com/is-it-down/supabase/2026-09-24/); [UptimeRobot 2026-09-28](https://uptimerobot.com/is-it-down/supabase/2026-09-28/); [Pingoru outage history](https://pingoru.io/providers/supabase/outage-history)
- Support anecdote: an "Ask HN: What in the world is going on at Supabase?" post (2025-10-16) complained that abuse reports went unanswered for months. The quoted auto-reply says "Free plan will receive no guaranteed support response". This is one anecdote. — [HN](https://news.ycombinator.com/item?id=45609621)

### Inferences
- **RankSEO on Supabase has to be event-driven, not a single long job.** A plausible design:
  - A Next.js server action creates the `report` row and triggers Bright Data.
  - The Bright Data webhook hits an Edge Function or Next.js route that verifies it and enqueues to pgmq.
  - A pg_cron job polls the queue every few seconds and invokes a short worker Edge Function that calls Claude within the 400 s paid-plan budget.
  - Progress goes out through `realtime.broadcast_changes()` on a private per-report channel.
  - A cron sweeper handles timeouts and retries.
  This is feasible, but you are hand-building a workflow engine from pgmq, cron and state columns.
- **The CPU limit, not wall-clock time, is the most likely surprise.** Waiting on Bright Data or Claude doesn't count toward the 2 s, because async I/O is excluded. Parsing and transforming large scrape payloads in Deno does count.
- **A hybrid is likely.** Teams that need workers longer than 400 s or CPU-heavy processing typically keep Supabase for Postgres, Auth and Realtime, and run workers elsewhere (Railway/Fly). That converges on the "composed stack", just with Supabase as the database and auth provider.
- **Atomic quotas fit Postgres well.** A per-period quota can be a single transactional `UPDATE … WHERE used < limit RETURNING` or a SECURITY DEFINER function, and entitlements can be enforced with RLS or server-side checks. This is standard Postgres capability, not a Supabase-specific feature.
- **Cost predictability is good at small scale.** Pro at $25 plus a Micro instance sits inside the cap. The spend cap does **not** cover compute upgrades or add-ons, so cost risk sits there and in egress and Realtime overages once the cap is turned off.
- **Lock-in is the lowest of the BaaS options for data and SQL.** Lock-in is moderate for Auth (GoTrue user store and JWT conventions), Edge Functions (Deno runtime) and Realtime APIs.
- **The MCP server is the most complete official BaaS MCP.** It is also the one with the most public prompt-injection scrutiny. The safe pattern is read-only plus project-scoped on production, with writes done on branches or dev projects.

### Gaps
- Queues GA status, throughput limits and pricing were not stated on the docs page I read.
- I could not confirm whether any official durable-workflow or long-running-job product launched in 2026. My searches found none.
- I did not verify a current figure for Edge Function cold starts.
- I did not get official incident postmortems from status.supabase.com; the incident data comes from aggregators.
- Discussion #36678's date and exact wording were not verified.
- I did not check Supabase Auth's built-in support for "leaked password protection" or bot heuristics beyond CAPTCHA.

## Convex (Oct 2026): reactive DB and realtime, actions and scheduling, Workflow/Workpool, Better Auth, Stripe/Polar, pricing, self-hosting, MCP and agent tooling, lock-in

### Takeaway
Convex is the closest built-in match to RankSEO's hardest requirement: a durable job that waits minutes on a third-party webhook while streaming progress. The Workflow component's `step.awaitEvent` plus `sendEvent` can be fired from an HTTP action that receives the Bright Data webhook. Workflows "survive server restarts", and reactive queries give live progress without extra plumbing. Mutations are transactions, which makes atomic quotas natural. Stripe, Polar, Rate Limiter and Better Auth components are listed in Convex's component directory; the Polar component's source lives in a contributor's repo. The costs:
- Higher lock-in: a document model, Convex-specific APIs, and a self-host licence that is FSL rather than OSI open source.
- Per-developer Pro pricing ($25/dev/month).
- Workflow determinism and size limits that need deploy discipline.
- A company that is smaller, though well funded ($57M Series B, August 2026).

### Cited Findings

#### Reactive data, functions, limits
- The pricing page counts "Explicit client calls, scheduled executions, subscription updates, and file accesses" as function calls, so live subscriptions are a metered first-class primitive. — [Convex pricing](https://www.convex.dev/pricing) (fetched raw HTML 2026-10-12)
- Reactivity is something you lose on migration. Convex's own migration post notes that React Query/TanStack Start "doesn't have" live queries, so you must manually invalidate. — [Convex Stack: How hard is it to migrate away from Convex?](https://stack.convex.dev/how-hard-is-it-to-migrate-away-from-convex) (vendor; undated)
- Execution limits:
  - Query/mutation: 1 s of user-code execution.
  - Convex-runtime actions: **30 min**.
  - Node.js actions: **10 min**.
  - Convex-runtime actions have 64 MiB RAM; Node actions have 512 MiB.
  — [Convex docs: Limits](https://docs.convex.dev/production/state/limits) (fetched 2026-10-12)
- Scheduling limits: one mutation can schedule up to 1,000 functions, and up to 1,000,000 scheduled functions can be outstanding. — [Convex docs: Limits](https://docs.convex.dev/production/state/limits) (fetched 2026-10-12)
- Per-transaction limits: 16 MiB read, 32,000 documents scanned, 16,000 documents written. Documents are capped at 1 MiB. — [Convex docs: Limits](https://docs.convex.dev/production/state/limits) (fetched 2026-10-12)
- Concurrency limits:
  - Free/Starter: 16 queries, 16 mutations, 64 actions, 8 scheduled jobs.
  - Professional: 256 queries, 256 mutations, 512 Convex/HTTP actions, 256 Node actions, 256 scheduled jobs.
  — [Convex docs: Limits](https://docs.convex.dev/production/state/limits) (fetched 2026-10-12)
- Other plan limits:
  - Developers per team: Free/Starter 1–6, Professional 1–20.
  - Deployments: 40 and 300 respectively.
  - Pricing outside the US is 1.3×.
  — [Convex docs: Limits](https://docs.convex.dev/production/state/limits) (fetched 2026-10-12)
- Plan features listed on Free & Starter include file storage, text search, vector search, crons, Auth, Node.js actions, preview deployments and selectable data region. Convex also sells an "AI Gateway" priced "Same as OpenRouter". — [Convex pricing](https://www.convex.dev/pricing) (fetched 2026-10-12)

#### Workflow and Workpool (durable steps and waiting on external events)
- Durability:
  - The component executes "long-running code flows durably with built-in retries, delays, and state persistence".
  - "Workflow state is persisted to the Convex database after each step".
  - "Workflows can run for months, and survive server restarts".
  - Status is observable "reactively via subscriptions".
  - Steps can run in parallel or in sequence, with configurable parallelism.
  — [Convex components: Workflow](https://www.convex.dev/components/workflow) (fetched 2026-10-12)
- Event APIs:
  - `await step.awaitEvent({ name })` pauses until an event arrives, and continues immediately if the event was already sent.
  - `sendEvent(ctx, components.workflow, { name, workflowId, value | error })` is called from a mutation or action.
  - `defineEvent()` takes typed validators.
  - `createEvent()` makes dynamic event IDs.
  - The README frames this as "human-in-the-loop flows or coordinating with other asynchronous flows". It does not mention webhooks explicitly.
  — [get-convex/workflow README](https://github.com/get-convex/workflow) (fetched 2026-10-12)
- Retries, completion and cancellation:
  - Actions are **not** retried by default unless `retryActionsByDefault` is set. Per-step retry options are `maxAttempts`, `initialBackoffMs` and `base`.
  - Mutations have "exactly-once execution".
  - `onComplete` runs exactly once with a success, error or canceled result.
  - `cancel()` is available.
  - `step.sleep()` and per-step `runAfter`/`runAt` are available.
  — [get-convex/workflow README](https://github.com/get-convex/workflow) (fetched 2026-10-12)
- Workflow limits:
  - Steps can take in and return a total of 1 MB of data per workflow.
  - The journal limit is 8 MiB.
  - Workflows must be deterministic: adding, removing or reordering steps, or renaming step functions, breaks in-flight workflows.
  - On Pro, keep total `maxParallelism` across workflows and workpools to about 100.
  - Workflow uses Workpool internally for parallelism limits.
  — [get-convex/workflow README](https://github.com/get-convex/workflow) (fetched 2026-10-12)
- A community Discord thread suggests that for webhooks, an HTTP action can either `sendEvent` or start a new workflow for the remaining steps. It also says the event docs are "not very clear". This is unofficial. — [Convex Discord Q&A](https://discord-questions.convex.dev/m/1442945134533677168) (search-derived)
- HN practitioner comment (2026-05-28), in a "Just Use Postgres for Durable Workflows" thread: "Convex has a workpool component that gives the ability to compose big complicated flows in an understandable way, and give you realtime updates on status of various pieces". — [HN comment](https://news.ycombinator.com/item?id=48314163)

#### Auth (Better Auth component)
- Convex + Better Auth is "a Convex Component that provides an integration layer for using Better Auth with Convex". It supports React, Vue, Svelte, Astro, Solid, **Next.js**, Nuxt, TanStack Start and Hono. — [labs.convex.dev/better-auth](https://labs.convex.dev/better-auth); [get-convex/better-auth](https://github.com/get-convex/better-auth) (fetched 2026-10-12)
- Plugins that work "out of the box" are Anonymous, Email OTP, Generic OAuth, JWT, Magic Link, One Tap, Phone Number, Two Factor and Username. SSO is incompatible because of Node.js dependencies. Other schema-changing plugins need "Local Install". The page gives no version or status label. — [Convex Better Auth: Supported plugins](https://labs.convex.dev/better-auth/supported-plugins) (fetched 2026-10-12)
- The **Rate Limiter** component supports token-bucket or fixed-window limits, keyed per user, IP or tier. "All rate limit changes will roll back if your mutation fails". Counters can be sharded, and it "fails closed, not open". — [Convex components: Rate Limiter](https://www.convex.dev/components/rate-limiter) (fetched 2026-10-12)

#### Billing components
- **Stripe** (`@convex-dev/stripe`):
  - Checkout for one-time payments and subscriptions, plus subscription create, update and cancel.
  - A customer portal and seat quantities.
  - Webhook sync at `https://<deployment>.convex.site/stripe/webhook`.
  - Payments, subscriptions and invoices exposed as real-time queries.
  — [Convex components: Stripe](https://www.convex.dev/components/stripe); [Convex Stack walkthrough](https://stack.convex.dev/how-to-use-convex-stripe-component) (search-derived)
- **Polar** (`@convex-dev/polar`) handles subscriptions with "built-in webhook handling and subscription state management". It supports "multiple plans, usage-based billing, and plan changes" and verifies webhook signatures. — [Convex components: Polar](https://www.convex.dev/components/polar) (fetched 2026-10-12)

#### Pricing (fetched 2026-10-12 from the raw pricing page)
- Plans:
  - **Free & Starter:** "$0/month and pay as you go" (Starter is pay-as-you-go beyond free limits), 1–6 developers.
  - **Professional:** "$25 per developer/month", 1–20 developers. Adds log streaming, exception reporting, HIPAA/SOC 2 reports, daily backups, custom domains and email support.
  - **Business & Enterprise:** "$2,500 monthly minimum", with SAML/SSO and SLAs.
  — [Convex pricing](https://www.convex.dev/pricing)
- Included resources and overage (Free/Starter vs Pro):

  | Resource | Free/Starter | Pro |
  |---|---|---|
  | Function calls | 1M (+$2.20/M) | 25M (+$2/M) |
  | Action compute | 20 GB-h (+$0.33) | 250 GB-h (+$0.30) |
  | Database storage | 0.5 GB (+$0.22/GB) | 50 GB (+$0.20/GB) |
  | Database I/O | 1 GB (+$0.22/GB) | 50 GB (+$0.20/GB) |
  | File storage | 1 GB (+$0.033/GB) | 100 GB (+$0.03/GB) |
  | Search storage | 0.5 GB (+$0.55/GB) | 1 GB (+$0.50/GB) |
  | Data egress | 1 GB (+$0.132/GB) | 50 GB (+$0.12/GB) |

  Query/mutation compute shows as "Free" on these plans (the rendering is ambiguous). — [Convex pricing](https://www.convex.dev/pricing)
- Usage limits:
  - Per-deployment **resource-based** limits have a warning (soft) and a disable (hard) threshold.
  - At the disable threshold "the deployment is disabled for the rest of the window and new function calls return an error".
  - Windows are UTC daily or monthly.
  - Team-level **spending limits** are dollar-based.
  - The page doesn't say which plans can set them.
  — [Convex docs: Usage limits](https://docs.convex.dev/production/usage-limits) (fetched 2026-10-12)
- Independent cost commentary:
  - One independent guide (dated after a 2026-08-18 check of the pricing page) says the resource that "surprises people is database bandwidth". — [omidsaffari.com](https://omidsaffari.com/blog/convex-pricing) (search-derived)
  - A migration plan notes that Convex bills every export as database and file bandwidth. — [beastypage issue #105](https://github.com/beastyrabbit/beastypage/issues/105) (search-derived)

#### Self-hosting and licence
- The self-hosted backend "supports all the free-tier features of the cloud-hosted product". The cloud product "is optimized for scale".
  - The default store is SQLite, and Postgres/MySQL and S3 are supported.
  - Docker Compose is the main path, with Fly.io and Railway as options.
  - Support comes through Discord `#self-hosted` and GitHub. The repo is synced with internal development "within a handful of days".
  — [convex-backend self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md) (fetched 2026-10-12)
- The licence is **FSL-1.1-Apache-2.0** ("Functional Source License, Version 1.1, Apache 2.0 Future License"), copyright 2026 Convex, Inc. — [convex-backend LICENSE.md](https://github.com/get-convex/convex-backend/blob/main/LICENSE.md) (fetched 2026-10-12)

#### MCP and agent tooling
- Setup: the official MCP server runs with `npx -y convex@latest mcp start`, and the docs show `claude mcp add-json` for Claude Code. — [Convex docs: MCP server](https://docs.convex.dev/ai/convex-mcp-server) (search-derived)
- Tools: `status`, `tables` (declared and inferred schemas), `data`, `functionSpec`, `run`, `runOneoffQuery`, `logs`, and `envGet`/`envList`/`envSet`/`envRemove`. — [Convex docs: MCP server](https://docs.convex.dev/ai/convex-mcp-server) (search-derived)
- Safety and scoping: production access is **off by default**, tools can be removed with `--disable-tools`, and `--project-dir` scopes the server to one project. — [Convex docs: MCP server](https://docs.convex.dev/ai/convex-mcp-server) (search-derived)
- The pricing-page navigation markets "AI Coding: Generate high quality Convex code with AI". It also shows "npm 1.7M weekly" and "GitHub 21,460 stars". — [Convex pricing](https://www.convex.dev/pricing) (vendor; fetched 2026-10-12)

#### Lock-in and migration
- Convex's own post, by Mike Cann, argues API lock-in is "not as bad as it might seem":
  - Functions port to TanStack Start, Drizzle and Postgres behind a Convex-style wrapper.
  - The hard parts are reactivity and the transaction semantics ("Drizzle Postgres transactions may not work precisely like the Convex ones"), and above all **Components**.
  - For lock-in worries it recommends "migrate to Convex self-hosted".
  — [Convex Stack](https://stack.convex.dev/how-hard-is-it-to-migrate-away-from-convex) (vendor; undated)
- Public Convex→Postgres migration plans and PRs (dates not verified):
  - Reelcast moved to Supabase Postgres with a `FOR UPDATE SKIP LOCKED` job queue and pg_cron, plus hooks that mimic `convex/react`. — [reelcast PR #1](https://github.com/khanblair/reelcast/pull/1)
  - BeastyPage had to type 22 `v.any()` fields first. — [beastypage #105](https://github.com/beastyrabbit/beastypage/issues/105)
  - PMGT planned a store-by-store cutover with reconciliation. — [pmgt-flow-suite #68](https://github.com/pmgt-it-consultancy/pmgt-flow-suite/issues/68)
- Secondary comparison sites rate Convex lock-in as "Moderate (Proprietary runtime / FSL 1.1 license)" and Supabase as the portable choice. These are blog opinions, not practitioner data. — [ScratchDB comparison](https://scratchdb.com/compare/convex-vs-supabase/); [StackMatchup](https://stackmatchup.com/supabase-vs-convex/)

#### Company and incidents
- $57M Series B on 2026-08-04, led by Insight Partners with a16z, Spark Capital and Etna Labs. Total funding is $110.5M. Funds go to core product, "agentic development tooling" and hiring. — [Dealroom](https://dealroom.co/news/142974-convex-raises-57m-series-b-for-its-ai-optimised-app-backend/); [VCA Online](https://www.vcaonline.com/news/2026080405/convex-raises-57m-series-b-led-by-insight-partners-to-scale-the-reliable-backend-for-the-ai-era/); [Pulse 2.0](https://pulse2.com/convex-raises-57-million-series-b-bringing-total-funding-to-110-5-million/amp/)
- One of the funding-coverage sources claims Convex powers "nearly 2 million applications", with customers including OpenAI and Zapier. These are press-release claims, and I did not confirm which outlet carried them. — [Dealroom](https://dealroom.co/news/142974-convex-raises-57m-series-b-for-its-ai-optimised-app-backend/); [VCA Online](https://www.vcaonline.com/news/2026080405/convex-raises-57m-series-b-led-by-insight-partners-to-scale-the-reliable-backend-for-the-ai-era/) (search-derived)
- 2026 incidents, mirrored by Pingoru from Convex's status page (I could not map each incident to its page; nothing found after 2026-06-15):
  - 2026-05-08: AWS availability-zone problem, about 1h49m.
  - 2026-05-22: a change broke HTTP actions for some deployments for nearly 4 hours (postmortem promised).
  - 2026-05-29: EU Pro errors, about 1h45m.
  - 2026-05-30: config restart, about 2 min.
  - 2026-06-15: high error rates on most deployments, about 12 min.
  — [Pingoru Convex incidents (one of several)](https://pingoru.io/providers/convex/incidents/2903369); [another](https://pingoru.io/providers/convex/incidents/4159963)

### Inferences
- **RankSEO maps almost one-to-one onto Convex primitives:**
  - A `startReport` mutation checks the quota transactionally (Rate Limiter or a counter doc) and starts a workflow.
  - Step 1, an action, triggers Bright Data.
  - `step.awaitEvent("brightdata:<jobId>")` waits up to 15 min without consuming resources.
  - The Bright Data webhook lands on an HTTP action that verifies the signature, stores the payload and calls `sendEvent`.
  - A Claude step runs as a Node action (10 min limit).
  - Each step writes progress into a document, which the Next.js client subscribes to.
  - A timeout path (`runAfter` plus cancel) covers a webhook that never arrives.
  On Supabase the same flow needs hand-built queue, cron and state code.
- **Scraped payloads go in documents or file storage, passed by ID.** The 1 MB per-workflow step-data limit and 8 MiB journal mean large payloads can't travel through steps.
- **Deploys must be workflow-version-aware.** Determinism means changing a workflow's steps while reports are in flight fails them, so you need new workflow names or drained queues.
- **Cost:** a solo developer pays $25/month on Pro, which is comparable to Supabase Pro. A three-person team pays $75/month before usage. Database bandwidth, function-call volume from live subscriptions and egress are the variables to model. Dollar-based spending limits plus deployment-disable thresholds give a harder cap than Supabase's spend cap, but hitting one takes production offline.
- **Lock-in is the main risk.** The data model, auth tables, components and reactive client are Convex-specific. The self-host escape hatch exists, but under FSL, and the self-host docs only promise "free-tier features". It is also unclear how well a Bright Data plus Claude workload performs on a single-node self-host.
- **Agent-fit is strong in a different way from Supabase.** Everything (schema, functions, workflows) is TypeScript in the repo, which suits Claude Code. The MCP server is local and deployment-scoped rather than a hosted multi-project control plane.

### Gaps
- Not confirmed:
  - Official docs on using `awaitEvent` specifically for third-party webhooks, or a maximum workflow duration or step count.
  - Whether the Better Auth component supports email verification links (as opposed to Email OTP) and Better Auth's built-in rate limiter without "Local Install".
  - The status of the older Convex Auth library.
  - Which plans can set usage and spending limits.
  - The Convex-runtime action limit of 30 min. That is what the limits page shows today, and I found no announcement of when it changed.
- I found no independent, detailed production retrospectives of Convex for AI workloads on HN. Searches for Convex-in-production comments returned noise. Reddit was not searchable with my tools.

## Briefly: Appwrite, Nhost and Firebase — where each stands in 2026 for this use case

### Takeaway
None is a better fit than Supabase or Convex for RankSEO.
- **Appwrite** has just re-architected itself (2.0, August–September 2026), adding native Postgres, an OAuth 2.1 server and a firewall. That makes it newly promising but newly unproven, and synchronous functions are capped at about 30 s.
- **Nhost** is a small Hasura-based Postgres BaaS with function execution caps of 180 s on Pro and 600 s on Team.
- **Firebase** has the longest-running managed functions (60 min HTTP, 30 min task queues) and Google-scale maturity. Against that: its relational offering was just renamed (Data Connect → SQL Connect, April 2026), Google retires adjacent tools (Firebase Studio sunsets March 2027), and there are well-publicised runaway-bill incidents.

### Cited Findings

#### Appwrite
- Appwrite 2.0 was announced on 2026-08-31 by CEO Eldad Fux. It includes:
  - The "Hyperloop B" engine, which the vendor says delivers 7× throughput at 6× less memory on I/O-bound workloads.
  - Console IV.
  - Native PostgreSQL 18, with 17 optional, plus backups, PITR, HA, a pooler, PostGIS, pgvector and pg_trgm. Compute starts at $10/month.
  - Native MySQL 8.4, VectorsDB and DocumentsDB.
  - An S3-compatible Storage API.
  - An OAuth 2.1/OIDC provider.
  - A project-level Firewall with rate-limit and challenge actions, which is Cloud-only.
  - Pro projects include $10 of database credits.
  — [Appwrite blog: Announcing Appwrite 2.0](https://appwrite.io/blog/post/announcing-appwrite-2)
- The self-hosted 2.0 release (2026-09-07) defaults to PostgreSQL, with MariaDB and MongoDB still selectable. It runs on 16 containers instead of 33, and Domains and Firewall are not available self-hosted. "Upgrading isn't required." — [Appwrite changelog 2026-09-07](https://appwrite.io/changelog/entry/2026-09-07); [AlternativeTo coverage](https://alternativeto.net/news/2026/9/appwrite-2-0-adds-direct-databases-s3-storage-and-oauth/)
- The pricing page (fetched 2026-10-12) shows dedicated database tiers from $10/month (Starter) to $4,099/month (Scale Max), PITR at +20%, and "$10 of compute credits for database usage included every month". The page body did not include Free/Pro plan prices or function limits. — [Appwrite pricing](https://appwrite.io/pricing)
- An official Functions template deploys a **stateless MCP server**. Tool calls are synchronous with a 30 s execution cap and a 25 s soft deadline, with no SSE streaming. (Date not shown.) — [Appwrite changelog](https://appwrite.io/changelog/9) (search-derived)
- Function timeouts come from community reports, not official docs:
  - Synchronous executions are hard-capped at 30 s.
  - Async executions can be raised to 900 s. **[>12 mo, possibly stale]**: the guide was tested on v1.5.x.
  — [markaicode guide](https://markaicode.com/errors/appwrite-timeout-fix/); [Appwrite self-host functions config](https://appwrite.io/docs/advanced/self-hosting/configuration/functions.md) (search-derived)
- Appwrite Sites (a Vercel-like hosting product) launched on HN on 2025-05-19 with 44 points. **[>12 mo]** — [HN](https://news.ycombinator.com/item?id=44029057)

#### Nhost
- Pricing page (fetched 2026-10-12):
  - Starter: $0. 1 GB database and 1 GB storage, 5 GB egress, 10 functions, 1 GB-hour, **10 s** execution time. "Project paused after 1 week of inactivity."
  - Pro: from $25/month with $15 of compute credits. 10 GB database, 50 GB storage, 50 GB egress, 50 functions, 10 GB-hours at $0.18/GB-hour, **180 s** execution time.
  - Team: from $599/month, **600 s** execution time.
  - Users are unlimited on every plan.
  - "We never stop your project and you will be charged for the excess usage."
  — [Nhost pricing](https://nhost.io/pricing)
- Aggregators describe Nhost as managed Postgres plus the Hasura GraphQL Engine. Separately, Hasura's own pricing moved to "DDN" plans, and DDN Free replaced the legacy Hasura Cloud free tier on 2026-04-19, per one aggregator. — [agentdeals: Hasura Cloud alternatives](https://agentdeals.dev/alternative-to/hasura-cloud); [frontdeskreview (Sept 2026)](https://frontdeskreview.com/software/backend-as-a-service/nhost/) (aggregators; unverified)

#### Firebase
- Maximum Cloud Functions durations:
  - 2nd-gen HTTP functions: **60 minutes**.
  - 2nd-gen scheduled and Task Queue functions: **1,800 s**.
  - Event-driven and 1st-gen functions: 540 s.
  - 2nd-gen memory goes up to 32 GiB.
  — [Firebase docs: Quotas and limits](https://firebase.google.com/docs/functions/quotas) ("Last updated 2026-10-08")
- Data Connect (managed Postgres via Cloud SQL, accessed through GraphQL) went GA on 2025-04-09. No-cost trials started on 2026-03-12. — [Firebase blog SQL Connect index](https://firebase.blog/category/sql-connect) (fetched 2026-10-12)
- On 2026-04-29 (Cloud Next 2026) it became **Firebase SQL Connect**, described as the same architecture with a renewed Postgres focus. The rename adds realtime query subscriptions through a new `@refresh` directive (interval-based or bound to mutations via CEL), raw SQL alongside GraphQL, and offline caching. — [Firebase blog: From Data Connect to SQL Connect](https://firebase.blog/posts/2026/04/whats-new-sql-connect) (search-derived)
- The Firebase MCP server launched in May 2025 as "experimental" and covers Firestore and Data Connect. **[>12 mo, possibly stale]**; the current status is unverified. — [Firebase blog: MCP server](https://firebase.blog/posts/2025/05/firebase-mcp-server/); [Firebase docs: MCP server](https://firebase.google.cn/docs/cli/mcp-server?hl=en)
- Firebase Studio sunset:
  - Announced 2026-03-19.
  - No new workspaces from 2026-06-22.
  - Shutdown on 2027-03-22.
  - Users are pointed to Google AI Studio and Antigravity.
  - Core Firebase services are unaffected.
  — [Firebase docs: Studio sunset and migration](https://firebase.google.com/docs/studio/migrating-project); [Storyboard18](https://www.storyboard18.com/digital/google-to-shut-firebase-studio-in-2027-shifts-focus-to-ai-studio-and-antigravity-92922.htm)
- Cost and reliability incidents on HN:
  - "€54k spike in 13h from unrestricted Firebase browser key accessing Gemini APIs" (2026-04-16, 400 pts). — [HN](https://news.ycombinator.com/item?id=47791871)
  - "Firebase SDK is crashing all iOS apps since this morning" (2026-09-29, 136 pts). — [HN](https://news.ycombinator.com/item?id=49889934)
  - A $70k one-day bill (2025-01-17). **[>12 mo]** — [HN](https://news.ycombinator.com/item?id=42732714)
  - A global outage (2025-06-12). **[>12 mo]** — [HN](https://news.ycombinator.com/item?id=44261426)

### Inferences
- **Appwrite** is now feature-comparable to Supabase on paper: Postgres, vector search, an OAuth server and a WAF-style firewall. But 2.0 is about six weeks old as of October 2026, and its function model (about 30 s sync, async with timeouts under about 15 min per community reports) means the same webhook-driven state machine as on Supabase. Its MCP story is a template, not a first-party control plane. Not the right choice for a team that values production maturity right now.
- **Nhost** execution caps (180 s on Pro) are tighter than Supabase's in practice. It is a small vendor depending on Hasura, whose strategy shifted to DDN, which adds a second layer of vendor risk. Low fit.
- **Firebase** could run long Claude calls directly (60-minute HTTP and 30-minute task-queue functions), and Task Queues can model the webhook wait. Three things count against it:
  - It is NoSQL by default; the Postgres option (SQL Connect) is GraphQL-first and was just renamed.
  - It has no Stripe or Better Auth-equivalent ecosystem fit with Next.js comparable to Supabase or Convex.
  - The documented runaway-cost incidents raise the "predictable cost" concern. I could not verify current hard-cap options.
  Lock-in to Google Cloud is high.

### Gaps
- Not verified:
  - Appwrite's official Cloud function timeout and Pro price in October 2026, since the pricing page body omitted them.
  - Appwrite Auth's CAPTCHA, abuse protection and email-verification specifics.
  - Nhost's 2026 roadmap and maturity signals, such as funding and incidents.
  - Whether Firebase now offers hard billing caps; I found budget-alert-era incidents only.
  - The current GA status of the Firebase MCP server.

## How do these compare with InsForge on maturity, feature completeness and agent-friendliness (MCP)? Head-to-head comparisons and benchmarks, and their independence

### Takeaway
On maturity the order is clear: Supabase (2020, $10.5B, >9M devs) ≫ Convex ($110.5M raised, ~21k GitHub stars) ≫ InsForge (founded 2025, YC P26, $8M seed in September 2026, most primitives shipped in 2026). The only head-to-head benchmark is InsForge's own (MCPMark Postgres subset, 21 tasks, run by InsForge's CTO).
- It favours InsForge on Sonnet 4.6: 42.86% vs 33.33% Pass⁴, and 7.3M vs 17.9M tokens per run.
- The task suite is independent (MCPMark, ICLR 2026), but the runs, configuration and choice of subset are the vendor's.
- I found no independent replication.
- It does not cover Convex at all.

### Cited Findings

#### InsForge's benchmarks (vendor-run)
- **v1, 2025-12-04 (Sonnet 4.5):**
  - Setup: 21 MCPMark Postgres tasks, each run 4×.
  - Pass⁴: InsForge 47.6% (10/21), Postgres MCP 38.1%, Supabase MCP 28.6%.
  - Tokens per run: 8.2M vs 10.4M vs 11.6M.
  - Time: about 150 s vs more than 200 s.
  - No server versions, configs or harness are given.
  — [InsForge blog (CTO Tony Chang)](https://insforge.dev/blog/mcpmark-benchmark-results)
- My own arithmetic on the post's figures: the headlines "1.6x faster", "~30% fewer tokens" and "up to 70% higher Pass⁴" do not all follow cleanly. 150 s vs ">200 s" supports at least 1.33×. 8.2M vs 11.6M tokens is about 29% fewer than Supabase but about 21% fewer than Postgres MCP. 47.6% vs 28.6% is about 66% higher. — derived from [InsForge blog](https://insforge.dev/blog/mcpmark-benchmark-results)
- **v2, 2026-03-02 (Sonnet 4.6), InsForge vs Supabase MCP only:**

  | Metric | InsForge | Supabase MCP |
  |---|---|---|
  | Pass⁴ | 42.86% | 33.33% |
  | Pass@4 | 76.19% | 66.67% |
  | Pass@1 | 58.33% | 47.62% |
  | Tokens per run | 7.3M | 17.9M |
  | Tokens per task | 358K | 862K |
  | Time per task | 156.6 s | 198.8 s |
  | Turns | 18.6 | 17.0 |

  — [InsForge blog: MCPMark v2](https://insforge.dev/blog/mcpmark-benchmark-results-v2) (fetched 2026-10-12)
- InsForge's explanation for the gap:
  - Its server surfaces backend state (record counts, RLS policies, foreign keys) up front.
  - Supabase's `search_docs` returns full GraphQL schema metadata, which it says costs 5–10× more tokens.
  - Supabase's MCP prompts more discovery queries.
  The Supabase MCP version and config are not stated. Raw results are published at [github.com/InsForge/mcpmark](https://github.com/InsForge/mcpmark/tree/main/results). — [InsForge blog: MCPMark v2](https://insforge.dev/blog/mcpmark-benchmark-results-v2)
- **Independence of the task suite:** MCPMark itself is an academic benchmark (arXiv 2509.24002, accepted to ICLR 2026) with 127 CRUD-heavy tasks across MCP servers. Its top model, gpt-5-medium, scored 52.56% pass@1 and 33.86% pass^4. — [arXiv](https://arxiv.org/abs/2509.24002); [ICLR 2026 poster](https://iclr.cc/virtual/2026/poster/10006866)
- A Turkish-language review contradicts this by calling MCPMark "InsForge's own internal benchmark". The arXiv paper shows that claim is wrong about the suite, though the runs are internal. — [pasqualepillitteri.it (TR)](https://pasqualepillitteri.it/tr/news/1345/superpowers-vs-insforge-karsilastirma-2026)
- Secondary coverage tends to repeat and mangle the numbers. Headlines claim "2.8x" token savings and mix v1 and v2 figures. — [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/3573/insforge-2-8x-token-claude-code-backend-agent-native-2026-en); [Level Up Coding](https://levelup.gitconnected.com/how-i-cut-my-claude-code-token-usage-by-2-8x-36ae89957c3a) (search-derived)
- A Sealos blog comparison (Sealos is a cloud vendor) reportedly says Supabase has more auth options and more production mileage, and that InsForge is faster to set up in agent-driven workflows. I saw the search snippet only. — [Sealos: InsForge vs Supabase](https://sealos.io/blog/insforge-vs-supabase/)

#### InsForge maturity and feature completeness
- Repo state (fetched 2026-10-12): 13.1k stars, 1.2k forks, Apache-2.0, 5,582 commits.
  - Primitives: auth, Postgres, S3-compatible storage, edge functions, an OpenAI-compatible model gateway, site deployment, and an MCP server (self-hosted and cloud) plus CLI and Skills (cloud only).
  - Compute (long-running containers) is labelled **"private preview"**.
  — [InsForge GitHub](https://github.com/InsForge/InsForge)
- Release timeline from the blog index:
  - Public launch on 2025-11-18.
  - Realtime on 2026-01-14.
  - Remote MCP on 2026-02-23.
  - CLI on 2026-02-24.
  - InsForge 2.0 on 2026-03-09.
  - Status page on 2026-03-07.
  - Custom SMTP on 2026-04-14.
  - Backup & Restore on 2026-04-22.
  - Payments on 2026-05-06.
  - Backend branching on 2026-05-14.
  - Self-hosted Docker compute on 2026-08-12.
  - A July 2026 post was titled "P50 13ms, P95 4.2s: What Was Going On?".
  — [InsForge blog index](https://insforge.dev/blog) (fetched 2026-10-12)
- Show HN, 2026-05-18 (62 pts, 7 comments), "Open-source Heroku for coding agents":
  - The founders said MCPs "have their own problems": tools "pre-loaded into context", payloads "returning 10k+ tokens", and things MCP can't do such as telemetry and configs. So they moved to "CLI and … Skills".
  - One commenter: "It's not an agentic database. It's postgres… no need to hype it up".
  — [HN](https://news.ycombinator.com/item?id=48181342)
- Funding: an $8M seed in September 2026 for this YC (Spring 2026, "P26") company founded in 2025 by Hang Huang and Tony Chang. Seedtable's URL slug suggests April 2026, and pre-seed figures conflict between sources ($970.6K, $1.5M or $3.5M). — [Dealroom](https://dealroom.co/news/158042-insforge-raises-8m-seed-to-build-cloud-infrastructure-for-ai-agents/); [Seedtable](https://seedtable.com/companies/insforge/funding-rounds/seed-2026-04)

#### Comparators' agent surfaces (for the same comparison)
- **Supabase:** a hosted OAuth MCP covering migrations, SQL, logs, advisors, Edge Function deploy, branching and cost tools, with read-only and project scoping. — [Supabase docs: MCP](https://supabase.com/docs/guides/getting-started/mcp)
- **Convex:** a local `npx convex mcp start` server for introspection, running functions, logs and env vars, with production access off by default. — [Convex docs: MCP](https://docs.convex.dev/ai/convex-mcp-server)
- **Supabase's agent strategy:** the Turso acquisition (2026-10-02) is framed explicitly around "agentic infrastructure". — [Supabase blog](https://supabase.com/blog/supabase-is-acquiring-turso)

### Inferences
- **The benchmark is not evidence of overall backend fitness.** It measures how efficiently an agent completes 21 Postgres administration and query tasks through each MCP: RLS, triggers, migrations, pgvector. It says nothing about durable jobs, auth flows, billing, uptime or support. It is useful as a signal that InsForge's tool payloads are leaner, and Supabase's `search_docs` verbosity is a plausible, checkable cause.
- **The independence is partial.** The suite is independent, but the vendor chose the subset, ran a single model per version and didn't disclose the competitor's MCP version or config. Treat it as vendor marketing with published raw data, so it is reproducible in principle, until someone replicates it.
- **Feature parity versus maturity.** InsForge now lists most BaaS primitives, but most shipped within the past 9–10 months, and long-running compute is still private preview. Supabase offers the same primitives with multi-year production history. Convex offers fewer SQL-style primitives but a stronger durable-workflow story than either.
- **For a Claude Code workflow,** Supabase's MCP is the broadest. Convex's code-first model means the agent mostly edits TypeScript and needs MCP less. InsForge's CLI-plus-Skills approach reflects its own judgement that MCP alone is a weak interface. All three can be driven from Claude Code.

### Gaps
- No independent head-to-head benchmark of BaaS MCP servers (Supabase vs Convex vs InsForge) or of agent productivity on full app builds turned up.
- InsForge's "Agent Benchmark: First Look" (2026-06-08, [blog index](https://insforge.dev/blog)) was not read.
- InsForge cloud pricing, SLA and incident history were not examined; that is out of scope for this note and probably covered elsewhere.

## Practitioner evidence (2025–2026): building AI SaaS on a BaaS vs a composed stack (Better Auth + Postgres + workers on Railway/Render/Fly)

### Takeaway
Practitioner evidence mostly consists of single-team migration stories and HN debate, not systematic data. Recurring BaaS failure modes are:
- Compute ceilings for long AI calls (Supabase Edge Function 150/400 s limits).
- RLS complexity and misconfiguration.
- Weak free-tier support.
- Runaway bills (Firebase).
- Vendor incidents, including clusters of hours-long ones at Supabase and Convex in 2026.

The composed stack's best-documented win is owning auth and sessions in your own Postgres. Val Town went Supabase → Render plus Clerk → Better Auth in May 2026 and reported no outages or bugs after the switch. Durable jobs can come from Postgres-backed libraries (DBOS) or platforms (Trigger.dev). The price is more pieces to operate, and the Better Auth library itself has changed hands: it joined Vercel in July 2026.

### Cited Findings

#### Migrations and "own your auth" sentiment
- **Val Town (Tom MacWright, 2026-05-06), "From Supabase to Clerk to Better Auth":**
  - They left Supabase (2023, details in an earlier post) for Render Postgres plus Clerk.
  - They then left Clerk over an account-wide "five requests per second" limit, two sources of truth (webhook-synced users table), and the fact that "if Clerk goes down, the whole website goes down", with uptime "teetering between two and three nines" since May 2025.
  - Better Auth migration: two weeks of dual-auth. LLMs helped write the transition code, but the final code was hand-reviewed. They reported no outages or bugs since.
  — [Val Town blog](https://blog.val.town/better-auth)
- HN discussion of the Val Town post (304 pts, 240 comments):
  - The top comment (107 replies) asks why "offload my postgres users table to some 3rd party provider". — [HN thread](https://news.ycombinator.com/item?id=48038827)
  - Another commenter: "Syncing external auth provider state with your user state is a bug center", and refreshing JWT access tokens is "another bug center" if you control your own auth. — [HN thread](https://news.ycombinator.com/item?id=48038827)
  - A third commenter reports Clerk downtime "causing the whole app to fail". — [HN thread](https://news.ycombinator.com/item?id=48038827)
- Better Auth's trajectory:
  - Launch HN on 2025-05-19.
  - A $5M raise from Peak XV and YC on 2025-06-25.
  - Auth.js became part of Better Auth on 2025-09-26.
  - **Better Auth joined Vercel on 2026-07-07** (HN, 128 pts).
  — [Launch HN](https://news.ycombinator.com/item?id=44030492); [TechCrunch via HN](https://news.ycombinator.com/item?id=44380185); [Better Auth blog: Auth.js joins](https://www.better-auth.com/blog/authjs-joins-better-auth); [Better Auth blog: joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel); [HN](https://news.ycombinator.com/item?id=48819512)
- A practitioner ripped Supabase out of a client's Next.js app in a multi-week refactor, citing RLS maintainability and testability (2025-04-22). **[>12 mo]** — [HN comment](https://news.ycombinator.com/item?id=43763733)

#### AI-workload failure modes on BaaS
- **Timeouts:**
  - Supabase Edge Functions cannot hold a request past 150 s, and background work stops at 400 s on Pro. A developer with GPT-5 calls running past 5 minutes was told queues only buy time up to 400 s (November 2025). — [GitHub #40074](https://github.com/orgs/supabase/discussions/40074)
  - The CPU-time cap (2 s) drives some teams off Edge Functions. — [GitHub #36678](https://github.com/orgs/supabase/discussions/36678) (search-derived)
- **Security misconfiguration:**
  - "All in one platforms … lure people into a sense of 'wow this is easy to use' such that they forget to check security" (2025-12-22). — [HN comment in RLS thread](https://news.ycombinator.com/item?id=46355345)
  - The prompt-injection exposure via MCP (July 2025). — [HN](https://news.ycombinator.com/item?id=44502318)
- **Cost blowups:** an unrestricted Firebase browser key ran up a €54k Gemini bill in 13 hours (2026-04-16). — [HN](https://news.ycombinator.com/item?id=47791871)
- **Support:** Supabase's free-plan auto-reply says there is "no guaranteed support response" (October 2025 anecdote). — [HN](https://news.ycombinator.com/item?id=45609621)
- **Vendor incidents in 2026:**
  - Supabase: regional database and compute failures of 1–4 hours (February, March, June and September 2026). — [Pingoru](https://pingoru.io/providers/supabase/outage-history)
  - Convex: a cluster in May–June 2026, including a nearly 4-hour HTTP-actions breakage on 2026-05-22. — [Pingoru Convex incident pages (individual page-to-incident mapping unverified)](https://pingoru.io/providers/convex/incidents/2903369)
  - Both come from third-party mirrors.

#### Composed-stack building blocks with practitioner traction
- DBOS (Postgres-backed durable workflows as a library) says it can run "reliable background jobs with no timeouts" and handle "anything that connects to an unreliable or non-deterministic API". It needs no separate orchestrator: "You can use Supabase, RDS, Neon, or any other Postgres provider." This is vendor text in a Show HN. — [Show HN: DBOS Go (2025-09-24)](https://news.ycombinator.com/item?id=45363319); [Show HN: DBOS Java (2025-11-13, 114 pts)](https://news.ycombinator.com/item?id=45920156)
- Trigger.dev Launch HN, "Open-source platform to build reliable AI apps" (2025-09-15, 162 pts). I read the title only. — [HN](https://news.ycombinator.com/item?id=45250720)
- The Reelcast Convex→Supabase-Postgres migration replaced Convex scheduling with a Postgres job queue: `FOR UPDATE SKIP LOCKED` atomic claiming, retries with backoff, resumable long work, and pg_cron. — [reelcast PR #1](https://github.com/khanblair/reelcast/pull/1) (search-derived; date not verified)
- Convex's own migration-away post lists the composed replacements: PG-Boss or BullMQ for scheduling, S3 for files, better-auth or Clerk for auth, Pusher for realtime. It notes "Components" are the hardest part to replicate. — [Convex Stack](https://stack.convex.dev/how-hard-is-it-to-migrate-away-from-convex) (vendor; undated)

### Inferences
- **For RankSEO's 15-minute webhook waits, none of the BaaS function runtimes (Supabase 400 s, Appwrite about 30 s sync, Nhost 180 s) "just works".** Two approaches do:
  - Durable-workflow primitives: Convex Workflow, DBOS on any Postgres, or Trigger.dev/Inngest-style platforms.
  - An always-on worker on Railway, Render or Fly reading a Postgres queue.
  That is the main technical argument for either Convex or a composed stack over Supabase-only.
- **Evidence favours owning auth state in your own Postgres.** That can be Supabase Auth (it already lives in your Postgres) or Better Auth. Externally hosted auth SaaS creates sync and SPOF problems (Val Town on Clerk). This argues against adding Clerk-style auth on top of any BaaS.
- **The composed stack shifts risk; it doesn't remove it.** You trade BaaS outages and limits for your own uptime of the worker and queue, more dashboards, and integration code. Library governance is also a factor: Better Auth is now Vercel-owned. Practitioners on HN who favour composed stacks are mostly experienced developers comfortable with ops.
- **A middle path:** Supabase (Postgres, Auth with CAPTCHA and rate limits, Realtime Broadcast, Stripe Sync Engine) plus one small worker service on Railway or Fly, using DBOS or a SKIP LOCKED queue, for the Bright Data → Claude pipeline. This keeps data lock-in low and uses Supabase's MCP for schema and debugging work. That is my synthesis; I found no direct practitioner write-up of this exact combination for AI-SEO.

### Gaps
- I found no systematic, independent study of BaaS vs composed-stack reliability, cost at scale or developer productivity for AI SaaS. The evidence is anecdotal: single migrations and HN threads.
- Reddit and X threads were not reachable with my tools. HN comment search for Convex production experiences returned mostly irrelevant hits.
- I found no direct evidence on Supabase Edge Function cold-start impact, or on Railway/Render/Fly worker reliability, for this workload.
- Cost-at-scale comparisons with real bills (Supabase vs Convex vs composed) were not found beyond pricing pages and one independent Convex pricing blog.
