# Durable background jobs, webhook waits, realtime progress and LLM access for the RankSEO rebuild (state as of 2026-10-12)

Conventions: every web source was fetched on 2026-10-12 unless noted otherwise. Where a page shows its own "last updated" date, that date is given. **[Vendor]** marks a vendor's own documentation or pricing, which is a vendor claim. **[Indep.]** marks an independent or third-party source. **[First-party]** marks RankSEO's own architecture review in this repo (`docs/rankseo-review/`), which is practitioner evidence about the current build. Anything older than about 12 months is flagged as possibly stale.

The pipeline being compared: an API route creates a report row, then a job starts 1–2 Bright Data collections. The job waits up to about 15 minutes for Bright Data's webhook delivery, makes one Claude structured-output call, computes metrics and saves the result, while the browser shows live progress. The current build uses Next.js 16, Better Auth 1.6, Trigger.dev 4.5.9 (exact pin), Vercel AI SDK 7 through AI Gateway (`anthropic/claude-sonnet-4.6`), and MongoDB through Prisma. Tasks get a waitpoint token with `idempotencyKey=<task>-<id>` and a 15-minute timeout, pass its URL to Bright Data as the delivery endpoint, and then call `wait.forToken`. — [First-party: ARCHITECTURE-REVIEW.md](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md); [CODEMAPS/architecture.md](/home/user/AISEO/docs/rankseo-review/CODEMAPS/architecture.md)

## 1. Trigger.dev v4: waitpoint/HTTP-callback tokens, realtime and streams, queues and concurrency keys, retries, pricing, cloud vs self-hosting (incl. Railway), maturity, MCP server

### Takeaway
Of the options compared, Trigger.dev **Cloud** is still the most turnkey match for this pipeline:
- A waitpoint token's HTTP callback URL can be handed straight to Bright Data.
- Cloud checkpoints waiting runs, so they use no compute and hold no concurrency slot.
- v4.7 added shared and per-tenant concurrency limits.
- Realtime React hooks are built in.
- It costs about $10/month (the Hobby plan) at RankSEO's volume.

The review findings are fixable inside Trigger.dev. Its lifecycle hooks, however, do not cover runs that are cancelled while suspended, crashed, or killed by the system, so a scheduled reconciler is required.

**Self-hosting Trigger.dev v4 is a poor fit for Railway:**
- The supervisor needs Docker-socket or Kubernetes access, which Railway does not provide.
- Self-hosted v4 has **no checkpoints**, so every 15-minute wait would keep a container running.
- The documented minimum is 3+ vCPU / 6+ GB for the webapp plus 4+ vCPU / 8+ GB for the worker.

### Cited Findings
**Waitpoint tokens and HTTP callbacks**
- `wait.createToken()` options:
  - `timeout`: default `"10m"`.
  - `idempotencyKey`: reusing it returns the same token with `isCached: true`.
  - `idempotencyKeyTTL`: default `"1h"`.
  - `tags`.

  The returned token has `id`, `url`, `isCached` and `publicAccessToken`. — [Vendor: Trigger.dev docs, Wait for token](https://trigger.dev/docs/wait-for-token)
- To complete a token over HTTP, "make an HTTP POST request to the `url` it returns". The JSON body becomes the token's output, and an empty body gives `{}`. The URL "is designed for server-to-server use and does **not** have CORS headers". The page describes no authentication on this URL, so the URL itself works as the secret. Browsers complete tokens with `publicAccessToken` at `/api/v1/waitpoints/tokens/{tokenId}/complete`, which has CORS. — [Vendor: Wait for token](https://trigger.dev/docs/wait-for-token)
- `wait.forToken` returns `{ ok, output, error }`. `.unwrap()` throws on timeout, and a timeout is the only error a wait can produce. `wait.completeToken(tokenId, output)` completes a token from backend code. The page states no maximum timeout. — [Vendor: Wait for token](https://trigger.dev/docs/wait-for-token)
- If an idempotency key is reused before it expires, the create-token REST endpoint returns the original token. That token may already be completed, so "wait.forToken() will continue immediately". — [Vendor: Waitpoints create API](https://trigger.dev/docs/management/waitpoints/create.md) (via search summary)
- Callback URLs for waitpoint tokens arrived in PR #2025, merged 2025-05-07. That is about 17 months ago, so the feature is mature, though this source is old. — [Indep./GitHub: PR #2025](https://github.com/triggerdotdev/trigger.dev/pull/2025); [Vendor: changelog "Wait for HTTP callback"](https://trigger.dev/changelog/wait-for-http-callback)
- [First-party] With a 15-minute token timeout, a retry gets the *same cached, timed-out token* (the key TTL is 1 hour), so it fails at once and "a late Bright Data delivery is lost after being paid for". — [ARCHITECTURE-REVIEW.md finding 18](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md)

**Compute and concurrency while waiting**
- From the pricing page:
  - A parent waiting on subtasks is checkpointed, and the wait doesn't count toward compute.
  - "Waits longer than 5 seconds are checkpointed and do not count toward compute" (for `wait.for`/`wait.until`).
  - "Tasks that are waiting do not count toward concurrency limits."

  — [Vendor: Trigger.dev pricing](https://trigger.dev/pricing)
- The concurrency docs say: "Concurrency is only released when a run reaches a waitpoint and is checkpointed." They add that `wait.for()`/`wait.until()` checkpoint **60 seconds** in, so shorter waits keep their slot. This conflicts with the pricing page's 5-second figure, though the two thresholds may cover compute and concurrency separately. — [Vendor: Queue concurrency docs](https://trigger.dev/docs/queue-concurrency)

**Queues and concurrency**
- Named limits use `concurrencyLimit({ name, total })` and are attached through `concurrency`. One limit can cap the combined runs of many tasks.
- `concurrencyKey` is passed at trigger time: "Each unique key value gets its own pool under every `perKey` bound the run holds". A `total` caps keyed and unkeyed runs together.
- `queue: { concurrencyLimit }` still works but is deprecated.
- Each environment has a base limit and a 2.0x burst factor. Individual limits are capped at the base.
- Limits can be paused, overridden or reset at runtime through the `concurrencyLimits` namespace.

— [Vendor: Queue concurrency](https://trigger.dev/docs/queue-concurrency)
- Recent changelog entries (dates are shown without a year; 2026 is inferred, see Gaps):
  - Sep 20: multiple concurrency limits per task, with runtime changes that need no deploy.
  - Sep 30: concurrency metrics and queue health.
  - Oct 1: **v4.7.0**, "multiple concurrency limits at once and a total limit for per-tenant concurrency".
  - Oct 6: v4.7.3, the latest at fetch time.

  — [Vendor: Trigger.dev changelog](https://trigger.dev/changelog); [Vendor: pricing page footer/changelog](https://trigger.dev/pricing)

**Retries, idempotency and lifecycle hooks**
- The retry default is inconsistent in the docs. The prose says "By default, we retry 3 times", while the options table defines `maxAttempts` as total attempts including the first, defaulting to 3. `maxDuration` has no default: "By default tasks can execute indefinitely". — [Vendor: Tasks overview](https://trigger.dev/docs/tasks/overview)
- `onFailure` "doesn't fire for some of the run statuses like Crashed, System failures, and Canceled". "onCancel only runs if the run is actively executing": if a run is cancelled while queued or suspended, "no machine is spun up and onCancel will not be called". `onCancel` gets 30 seconds of grace. — [Vendor: Tasks overview](https://trigger.dev/docs/tasks/overview). This confirms [First-party finding 12](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md), where reports stay `COLLECTING` after a cancel, `maxDuration`, or a crash during `wait.forToken`.
- Idempotency keys:
  - Supported on `trigger()`, `triggerAndWait()` and `batchTrigger()`. A duplicate trigger returns the original run's handle.
  - Default TTL is **30 days**.
  - "When a run with an idempotency key fails, the key is automatically cleared." Successful and cancelled runs keep their keys.
  - Scopes are `run` (default for raw strings since v4.3.1), `attempt` and `global`. Outside a task, every scope behaves as global.
  - Keys are isolated per task and environment.
  - Side effects inside `run()` still rerun on retry and need their own idempotency.
  - Payload-hash idempotency is not built in.

  — [Vendor: Idempotency docs](https://trigger.dev/docs/idempotency)
- [First-party] The current build passes no idempotency key on `tasks.trigger`. Because the SDK retries API calls, duplicate paid runs are possible (the review marks this as inferred). — [ARCHITECTURE-REVIEW.md finding 11](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md)

**Realtime and streams**
- Realtime has two parts:
  - Run updates: status, metadata and tag changes, "powered by Electric SQL (HTTP-based PostgreSQL syncing)", consumed with `useRealtimeRun`.
  - Streaming: `streams.define()` in the task, consumed with `useRealtimeStream`.

  "All Realtime hooks and functions require authentication." — [Vendor: Realtime overview](https://trigger.dev/docs/realtime/overview)
- Concurrent Realtime connections by plan: Free 10, Hobby 150, Pro 1,000+ (an extra 1,000 costs $10/month). — [Vendor: pricing](https://trigger.dev/pricing)
- Changelog (year inferred as 2026):
  - Aug 28, v4.5.14: realtime stream subscriptions can start from "latest", with cursor resumption and a `useSessionStream` hook.
  - Aug 31, v4.5.15: named side channels on Sessions.

  — [Vendor: changelog](https://trigger.dev/changelog)
- [First-party] Live progress in the current build is fragile. A subscription error shows the failure card, and `useRealtimeRun`'s `hasCalledOnCompleteRef` never resets when a retry reuses the component. The suggested fix is `key={runId}` plus a polling fallback. — [ARCHITECTURE-REVIEW.md finding 13](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md)

**Pricing (fetched 2026-10-12; the page shows no "last updated" date)**

| Plan | Price | Included credit | Concurrent runs | Log retention | Realtime connections | Other |
|---|---|---|---|---|---|---|
| Free | $0 | $5 | 20 | 1 day | 10 | Tasks **stop once the $5 credit is used** |
| Hobby | $10/mo | $10 | 50 | 7 days | 150 | |
| Pro | $50/mo | $50 | 200+ (+$10/mo per 50) | 30 days | 1,000+ | |

Other pricing details:
- Compute per second: Micro (0.25 vCPU) $0.0000169; Small 1x (0.5 vCPU / 0.5 GB, the default) $0.0000338; Small 2x $0.0000675; Medium 1x $0.0000850.
- Each run invocation costs $0.000025. Dev-environment runs are free.
- The API rate limit is 1,500 requests/min.
- Billing alerts fire at 75–500% of budget. They are alerts, not hard caps.

— [Vendor: Trigger.dev pricing](https://trigger.dev/pricing)

**Self-hosting**
- Features missing from self-hosting:
  - Warm starts.
  - Autoscaling: worker nodes are scaled manually.
  - **Checkpoints**: "Non-blocking waits, less resource usage" are Cloud-only.

  Support is community-only through Discord. v3 is end-of-life: 4.5.0 is the last version that supports v3 tasks. — [Vendor: Self-hosting overview](https://trigger.dev/docs/self-hosting/overview)
- Docker self-hosting:
  - The webapp machine runs the webapp, Postgres and Redis. The worker machine runs the supervisor and all task runs.
  - Bundled services: ClickHouse (≥25.8), s2-lite for realtime streams v2, a container registry and object storage.
  - Minimums: webapp "3+ vCPU" and "6+ GB RAM"; worker "4+ vCPU" and "8+ GB RAM".
  - The guide states "No checkpoint support". The feature was experimental and caused issues.
  - Telemetry is on by default.
  - Only the latest release line gets security patches.
  - The guide alone is "unlikely to produce a production-ready deployment".

  — [Vendor: Docker self-hosting](https://trigger.dev/docs/self-hosting/docker)
- On Railway, a community template keeps the webapp, Postgres, Redis, ClickHouse, MinIO and the registry on Railway. It runs the supervisor on a DigitalOcean droplet because "Railway's platform restrictions prevent Docker socket access". The template comes from a third-party fork, its content is internally inconsistent, and no official Trigger.dev template for Railway was found. The official compose file reaches the Docker socket through a Docker Socket Proxy. Kubernetes uses the official Helm chart. — [Indep.: Railway template](https://railway.com/deploy/triggerdev); [Railway template (alt)](https://railway.com/deploy/triggerdev--triggerdev); [Vendor: Docker guide](https://trigger.dev/docs/self-hosting/docker)

**Maturity and license**
- The repository is Apache-2.0 with 16.5k GitHub stars. The README links Docker Compose and Helm self-hosting guides. — [Indep./GitHub: triggerdotdev/trigger.dev](https://github.com/triggerdotdev/trigger.dev)

**MCP server**
- The official MCP server is installed with `npx trigger.dev@latest install-mcp`. Its tools cover searching docs (no auth), deploying to environments, listing and inspecting runs, triggering tasks and cancelling runs. It has a read-only mode that hides `deploy`/`trigger_task`/`cancel_run`, and a dev-only flag. The launch blog uses an older install command. — [Vendor: MCP introduction](https://trigger.dev/docs/mcp-introduction); [Vendor: changelog "Official MCP Server"](https://trigger.dev/changelog/official-mcp-server)
- v4.6.1 fixed an MCP server crash on `tools/list`. A Sep 3 entry, "Set up Trigger.dev with your AI agent", covers connecting coding agents. — [Vendor: changelog](https://trigger.dev/changelog)

**Third-party comparisons (low reliability)**
- 2026 SEO-style comparison blogs present Trigger.dev as Apache-2.0 with "the most mature self-hosted path". One claims Trigger.dev's "free tier includes 50K task runs/month… ~$30/month for 500K runs". That **conflicts with the official credit-based pricing** above, so treat these blogs as unreliable. — [Indep.: automationatlas](https://automationatlas.io/guides/trigger-dev-vs-inngest-2026-comparison/); [Indep.: pkgpulse](https://www.pkgpulse.com/guides/hatchet-vs-trigger-dev-v3-vs-inngest-durable-workflows-2026); contradicted by [Vendor: pricing](https://trigger.dev/pricing)

### Inferences
- **Compute cost at RankSEO scale.** Assume 60–120 s of active compute per report on Small 1x, with the Bright Data wait checkpointed and unbilled. That is about $0.002–0.004 per report, so ≈ $2–4/month for 1,000 reports and ≈ $20–41/month for 10,000. This fits Hobby's $10 included credit at low volume. The Free plan is unsafe for production because tasks stop when its credit runs out. These figures assume 60–120 s of active compute per report (my estimate; no measured run durations were available).
- **Fixes within Trigger.dev.** The review's issues map onto Trigger.dev features:
  - `idempotencyKey: report.id` on `tasks.trigger`.
  - `concurrencyKey: userId` with a `perKey` bound, plus a global `total`.
  - A scheduled reconciler task for cancelled, crashed or `maxDuration` runs. Lifecycle hooks can't do this, per the docs.
  - Zod validation of the waitpoint output.
  - When a token times out, poll Bright Data's `/progress` and download by `snapshot_id` instead of failing (see section 6).
- **Idempotency key design.** Because the waitpoint idempotency key returns cached, already-completed or timed-out tokens for an hour, it should include the attempt or snapshot ID. Alternatively, the token timeout should not end the run.
- **Callback auth.** The callback URL carries no auth, so treat it as a bearer secret: don't log it. Bright Data's `auth_header` adds nothing here.
- **Railway (option a).** Trigger.dev Cloud runs task compute on Trigger.dev's infrastructure, not Railway. Tasks would reach Railway Postgres over the public network through a TCP proxy, or call back into the app's API. That adds latency and egress at $0.05/GB on Railway (see section 8 for Railway pricing).
- **Self-hosting on Railway.** It is not a sensible cost or ops trade at this scale:
  - It needs a hybrid Railway + VM setup.
  - It has no checkpoints, so each report would hold a worker container and a concurrency slot for up to 15 minutes.
  - The recommended 7 vCPU / 14 GB would be ≈ $280/month on Railway if fully used ($20/vCPU-month + $10/GB-month). That is an upper bound, since Railway bills actual usage.

### Gaps
- The changelog shows month and day without a year. 2026 is inferred from three clues: the pricing page's © 2026 footer, the self-hosting guide naming ClickHouse 26.2, and RankSEO pinning 4.5.9 next to 2026-era dependencies. Confirm the dates on GitHub releases.
- The docs don't state a maximum waitpoint token timeout, the payload size accepted by `token.url`, or whether that endpoint accepts gzip bodies. Bright Data gzips by default (section 6).
- The docs don't confirm whether a run waiting on a *token* is checkpointed immediately. The 5 s and 60 s thresholds quoted cover `wait.for`.
- The Trigger.dev status page has an incident report ([trigger.openstatus.dev report 273](https://trigger.openstatus.dev/events/report/273)) that was not fetched. No independent uptime data was gathered.
- No independent practitioner reports (Reddit, HN, blogs) about v4 waitpoints in production were found. The search found only docs and SEO comparisons.

## 2. Inngest: step.waitForEvent and webhook ingestion, realtime, concurrency/throttle/rate-limit keys, pricing, self-hosting, Next.js integration

### Takeaway
Inngest fits a Railway-hosted Next.js app well. Functions run in your own app or worker, either through `serve()` at `/api/inngest` or through `connect()` over an outbound WebSocket. `step.waitForEvent` doesn't hold a concurrency slot. Per-user concurrency keys, 24-hour idempotency keys, and `inngest/function.cancelled` and `inngest/function.failed` system events directly address the review findings.

The catches:
- Inngest webhooks don't verify signatures and don't document gzip support.
- Event size is capped at 256 KiB on Free and 3 MiB on Pro, so Bright Data deliveries should go through your own endpoint or Bright Data's status-only `notify` URL.
- Pro starts at $99/month.
- The self-hostable server is SSPL-licensed and comes with no support guarantee.

### Cited Findings
**waitForEvent**
- Signature: `step.waitForEvent(id, { event, timeout, match | if }) → Promise<null | EventPayload>`.
  - `timeout` accepts an `ms`-style string, milliseconds, a `Date` or Temporal types.
  - `match` (dot-path equality) and `if` (a CEL expression over `event` and `async`) can't be combined.
  - CEL's `in` operator is unsupported.
  - The call must be awaited.
  - A losing `waitForEvent` in a `group.parallel()` race is not cancelled.
  - No maximum timeout is stated.

  — [Vendor: step.waitForEvent reference](https://www.inngest.com/docs/reference/functions/step-wait-for-event)

**Webhook ingestion**
- Webhook URLs are created in the dashboard. A JS transform receives `evt`, `headers`, `queryParams` and `raw`, and returns `{ name, data, id?, ts? }`.
  - A transform that throws makes Inngest return a 400 to the provider.
  - Inngest does **not** verify provider signatures: "Your function must verify each request's signature itself."
  - Supported content types are `application/json`, `application/x-www-form-urlencoded` (beta) and `multipart/form-data` (beta). Gzip is not mentioned.
  - Allow/deny lists can be set for event names and IPs.
  - Webhooks can be managed through the REST API.

  — [Vendor: Inngest webhooks](https://www.inngest.com/docs/platform/webhooks)

**Size limits**
- Event size is 256 KiB on Free and 3 MiB on Pro/Business. — [Vendor: Inngest pricing](https://www.inngest.com/pricing)
- Requests from Inngest to your app "can be up to 4 MB". — [Vendor: Serving Inngest functions](https://www.inngest.com/docs/learn/serving-inngest-functions)

**Concurrency and flow control**
- `concurrency` accepts a `key` CEL expression, such as `event.data.accountId`, so a per-user limit is straightforward.
  - "Functions can specify up to 2 concurrency constraints at once."
  - Scopes are `fn` (default), `env` and `account`.
  - "step.sleep(), step.sleepUntil(), step.waitForEvent(), and step.invoke() do not use a slot while they wait."
  - Throttling (start rate) and rate limiting (skipping excess events) are separate controls.
  - The maximum limit depends on the plan.

  — [Vendor: Concurrency guide](https://www.inngest.com/docs/guides/concurrency)

**Idempotency**
- An event `id` deduplicates for 24 hours.
- A function-level `idempotency` CEL key allows "one function execution per 24 hour period".
- A step's external call can succeed before Inngest records the result, so use a stable operation key and not a retry attempt ID.

— [Vendor: Handling idempotency](https://www.inngest.com/docs/guides/handling-idempotency)

**Cancellation and failure hooks**
- The `inngest/function.cancelled` system event fires when a run is cancelled by a `cancelOn` event, a function timeout, the REST API or bulk cancellation. A cleanup function can subscribe to it, filtered by function ID. Failures emit `inngest/function.failed`. — [Vendor: function.cancelled reference](https://www.inngest.com/docs/reference/system-events/inngest-function-cancelled); [Vendor: cleanup example](https://www.inngest.com/docs/examples/cleanup-after-function-cancellation); [Vendor: failure handlers](https://inngest.com/docs/features/inngest-functions/error-retries/failure-handlers)

**Realtime**
- Model: channels with topics.
  - `step.realtime.publish()` is durable, so "a retry doesn't resend these updates".
  - `inngest.realtime.publish()` is for high-frequency updates.
  - The server mints a subscription token that limits a client to one channel and chosen topics.
  - React uses a `useRealtime` hook.
  - The Python SDK support is beta.
  - The page states no release stage, persistence or replay behavior.

  — [Vendor: Inngest Realtime](https://www.inngest.com/docs/features/realtime)
- Realtime limits: Free 50 connections and 250k messages/day; Pro 1,000 and 1M/day; Business 5,000 and 5M/day. — [Vendor: pricing](https://www.inngest.com/pricing)

**Pricing (fetched 2026-10-12; no effective date shown)**

| Plan | Price | Executions | Concurrent steps | Trace history | Max run length | Events | Seats |
|---|---|---|---|---|---|---|---|
| Free | $0 | 50k/mo (execution pauses at quota) | 5 | 24 h | 30 days | 500k/mo | 5 |
| Pro | from $99/mo | 1M/mo, then $0.000050 down to $0.000015 each | 100 (+$25 per 25) | 7 days | 90 days | | |
| Business | from $499/mo | 10M/mo | 500 | | | | |

Executions are "runs × (steps + 1)": a run with 5 `step.run()` calls uses 6. The page doesn't say whether sleeps or `waitForEvent` steps count. — [Vendor: Inngest pricing](https://www.inngest.com/pricing)

**Self-hosting and license**
- Supported "as of the 1.0 release".
  - Packaging: a single binary (`inngest start`), with the Event API and dashboard on 8288 and Connect on 8289.
  - Persistence is SQLite by default and "does not support scaling beyond a single node". Redis is in-memory by default, with external Redis available through `redis-uri`. Postgres is set through `postgres-uri`.
  - "The Inngest server does not automatically delete old database rows."
  - A Helm chart supports KEDA autoscaling.
  - Prometheus metrics are unauthenticated by default.
  - "No guaranteed direct support for self-hosted instances."

  — [Vendor: Self-hosting](https://www.inngest.com/docs/self-hosting)
- License: the server and CLI are under the Server Side Public License with delayed open-source publication as Apache 2.0. The SDKs are Apache-2.0. The repo has 5.9k stars. — [Indep./GitHub: inngest/inngest](https://github.com/inngest/inngest)
- Self-hosting was announced with Inngest 1.0 in September 2024 (possibly stale, >12 months). — [Vendor: Inngest 1.0 blog](https://www.inngest.com/blog/inngest-1-0-announcing-self-hosting-support)

**Next.js integration**
- The App Router handler is `export const { GET, POST, PUT } = serve({ client, functions })` at `/api/inngest`.
- `streaming: true` is opt-in. On Vercel Fluid compute it helps reach the 800 s maximum.
- `connect()` is the alternative for "container runtimes and long-running workers" over "an outbound WebSocket connection". Functions can move between `serve()` and `connect()`.
- The signing key goes in `INNGEST_SIGNING_KEY`.

— [Vendor: Serving Inngest functions](https://www.inngest.com/docs/learn/serving-inngest-functions)

**Analyst view (secondary)**
- Inngest saves each step's output outside the runtime and replays from the last completed step after a timeout, cold start or deploy. Postgres support and HA were described as still maturing. — [Indep.: Sacra on Inngest](https://sacra.com/c/inngest/)

### Inferences
- **Bright Data into Inngest.** Point Bright Data's `notify` URL (status only, small, see section 6) or a thin endpoint in your app at an Inngest webhook or `inngest.send`. Emit `brightdata/snapshot.ready` with `id = snapshot_id` so duplicate deliveries are dropped for 24 hours. Then `waitForEvent` with `if: "async.data.snapshotId == event.data.snapshotId"`, or a `match` on a shared field, and download the snapshot inside a `step.run`. This avoids gzip, the 256 KiB/3 MiB event caps and the lack of signature checks. For `auth_header`, check the header in your own endpoint, or in the transform by throwing to return a 400.
- **Lifecycle findings.** `inngest/function.cancelled` (which covers function timeouts) and `inngest/function.failed` let a cleanup function cancel the Bright Data snapshot and mark the report `FAILED`. That fixes finding 12 without a polling reconciler, though a reconciler is still advisable for runs that never started.
- **Cost.** At ~6–10 steps per report (≈7–11 executions), 1,000 reports/month ≈ 7k–11k executions, within Free's 50k. Free's 5 concurrent steps and 24 h trace history are tight for production, though. ~10,000 reports/month would exceed Free and require Pro at $99/month or more, about 10× Trigger.dev Hobby.
- **Railway (option a).** Inngest keeps compute *next to the database on Railway*. Steps run inside the Railway Next.js service, or a worker using `connect()`, on the private network. Railway's HTTP rules (15 min with data flowing, 5 min idle; section 5) comfortably cover a 30–120 s Claude step, and `streaming: true` or `connect()` removes the concern entirely.
- **Possible race.** It is not documented whether an event that arrives *before* `waitForEvent` registers will match (see Gaps). Bright Data collections take minutes, so the risk is low. Still, persist deliveries and check the database or `/progress` before waiting.

### Gaps
- No explicit statement on whether `waitForEvent` or sleep steps are billed as executions.
- No statement on whether events received before `waitForEvent` is called are matched.
- Inngest Realtime's release stage, message persistence and replay, and self-hosted support weren't documented on the fetched page.
- The webhook payload size limit and gzip support aren't documented.
- No independent production reports of self-hosted Inngest were found. The search turned up only vendor posts and an analyst summary.

## 3. Other durable-execution options: Vercel Workflow (Workflow SDK/DevKit), Hatchet, Restate, DBOS, Temporal (and Upstash Workflow): webhook waits and running off Vercel

### Takeaway
All of these engines can pause on an external callback, and all can run off Vercel, but they differ a lot in maturity off Vercel:
- **Vercel Workflow** has a first-class `createWebhook()` URL at zero compute while suspended. Its off-Vercel Postgres World is explicitly a "reference implementation… not optimized for scale, speed, or security".
- **DBOS** is the lightest fit for Railway + Postgres. It is a library: workflows `DBOS.recv` with a timeout, and your webhook route calls `DBOS.send` with an idempotency key.
- **Hatchet Cloud** has a generous pay-as-you-go tier (1M runs included), frees worker slots while waiting for events, and is MIT-licensed.
- **Restate** awakeables can be resolved over HTTP but add a stateful server to run.
- **Temporal** is overkill: its Business plan starts at $500/month.

### Cited Findings
**Vercel Workflow / Workflow SDK**
- `createWebhook()` returns an auto-generated URL for an external service. The workflow "suspends with zero compute cost" until a request arrives. `createWebhook()` always generates random tokens. Deterministic tokens are only for `createHook()` with `resumeHook()`, called from your own code. — [Vendor: Hooks & Webhooks](https://useworkflow.dev/docs/foundations/hooks); [Vendor: Webhooks cookbook](https://useworkflow.dev/cookbook/common-patterns/webhooks); [Vendor: createHook reference](https://useworkflow.dev/docs/api-reference/workflow/create-hook)
- The docs domain now redirects with a 308 from useworkflow.dev to workflow-sdk.dev, observed 2026-10-12.
- Worlds: Local (dev), Vercel (automatic on Vercel), Postgres (`@workflow/world-postgres`) and community or custom Worlds, selected with `WORKFLOW_TARGET_WORLD`. The page was last updated 2026-10-08. — [Vendor: Deploying](https://workflow-sdk.dev/docs/deploying)
- Postgres World (last updated 2026-10-08):
  - Described as a "reference implementation" that implements the full World spec and is tested, but "not optimized for scale, speed, or security".
  - Queueing uses **graphile-worker**. Streaming uses LISTEN/NOTIFY.
  - It "requires a long-lived server or worker process" that calls `world.start()`, and is not compatible with serverless or Vercel.
  - The `/.well-known/workflow/v1/flow` route has no built-in authentication. There is no end-to-end encryption.
  - Execution is at-least-once.
  - Hooks and webhooks are supported, with 30-day hook retention by default.
  - Parent/child polls each hold a worker slot.

  — [Vendor: Postgres World](https://workflow-sdk.dev/worlds/postgres)
- On-Vercel pricing (last updated 2026-09-16):

  | Resource | Hobby included | On-demand rate |
  |---|---|---|
  | Workflow Events | 50,000/month | $0.02 per 1K |
  | Data Written | 1 GB | $0.50/GB |
  | Data Retained | not available on Hobby | $0.50/GB-month |

  - A normal step produces 3 events, plus 1 per retry.
  - Functions are billed at normal compute rates, and Vercel Queues is billed separately.
  - Limits: 50 MB payloads, 255-byte hook tokens, no maximum run or sleep duration, a 240 s maximum replay, and retention of 1 day (Hobby), 7 days (Pro) or 30 days (Enterprise).

  — [Vendor: Workflow pricing and limits](https://vercel.com/docs/workflows/pricing)
- Vercel Workflows became generally available in mid-April 2026. — [Indep./community: Vercel weekly recap Apr 10–17, 2026](https://community.vercel.com/t/vercel-weekly-2026-04-20/38580) (a secondary source; no official GA post was fetched)

**Hatchet**
- A durable task's `WaitForEvent` survives interruption. The task becomes evictable, "the worker slot is freed", and the task is re-queued when the event arrives. Events are pushed with the event client using a matching key. Hatchet uses Postgres as its durability layer. — [Vendor: Hatchet events docs](https://docs.hatchet.run/llms/v1/events.md); [Vendor: Launch Week 01](https://hatchet.run/launch-week-01)
- Pricing:
  - Pay-as-you-go with a card is $0 to start. It includes **1M task runs and 1M events per month**, then $30 per extra million runs and $5 per extra million events. Limits are 100 workers, 10,000 worker slots, 100 webhooks, 1,000 cron jobs and 7-day retention.
  - Without a card: 2,000 runs/day and 1-day retention.
  - Retries don't count as runs.
  - **MIT license**: self-hosting is free, with self-host support on Custom plans.

  — [Vendor: Hatchet pricing](https://hatchet.run/pricing)

**Restate**
- `ctx.awakeable<T>()` returns `{ id, promise }`. Completion comes from `ctx.resolveAwakeable` or `ctx.rejectAwakeable` in another handler, or over HTTP at the ingress `/restate/awakeables/{id}/resolve` (JSON body) or `/reject`. The handler "suspends here until external completion". Long waits should be combined with a durable timer for a timeout. Workflow promises are retained for 24 hours by default. — [Vendor: Restate TS awakeables](https://docs.restate.dev/develop/ts/awakeables)
- Pricing (third-party only; the official page wasn't machine-readable): the free tier has 50k actions/month; Starter is $75/month for 5M actions; Business is $300/month for 20M; extra actions cost $25 per million. The self-hosted server is described as BSL-licensed. **Unverified.** — [Indep.: devtune.ai Restate pricing](https://devtune.ai/verticals/workflow-orchestration-and-durable-execution/restate/pricing)

**DBOS**
- `DBOS.recv` can only be called inside a workflow. It returns null on timeout, and the default timeout is 60 s. `DBOS.send(workflowId, message, topic)` with an idempotency key means "the message will only be sent once no matter how many times DBOS.send is called". Messages are persisted in Postgres. The official tutorial has a checkout workflow wait on a payment webhook this way. — [Vendor: DBOS workflow communication](https://docs.dbos.dev/typescript/tutorials/workflow-communication); [Vendor: DBOS methods](https://docs.dbos.dev/typescript/reference/methods)
- DBOS "stores your program's execution state (e.g., which workflows are currently executing and which steps they've completed) in a Postgres database". — [Vendor: Why DBOS](https://docs.dbos.dev/why-dbos)
- Pricing:
  - DBOS Transact (open source) is free.
  - Pro is $99/month: 1M checkpoints, then $50 per million.
  - Teams is $499/month: 10M checkpoints, then $40 per million.
  - Enterprise is custom and can self-host Conductor.
  - DBOS Cloud is priced through sales.

  — [Vendor: DBOS pricing](https://www.dbos.dev/pricing)

**Temporal**
- Cloud pay-as-you-go starts at $50 per million actions, with self-service volume discounts down to $25 per million. New accounts get $150 of credits for 90 days. Business starts at $500/month, or 10% of usage if greater. Active storage is $0.042/GB-hr. — [Vendor: Temporal pricing](https://temporal.io/pricing)

**Upstash Workflow**
- Upstash Workflow (the ADR's other alternative) has its own `context.createWebhook()` / `waitForWebhook` API. It is a different library from Workflow SDK. — [Vendor: Upstash createWebhook](https://upstash.com/docs/workflow/basics/context/createWebhook.md) (seen via search; not researched further)

### Inferences
- **Off-Vercel suitability for Railway + Postgres:**
  1. **DBOS** adds no new vendor: it is a library plus your existing Postgres, with a webhook route that calls `DBOS.send`. Conductor is an optional paid add-on.
  2. **Hatchet Cloud**: managed, with workers on Railway and 1M free runs.
  3. **Workflow SDK + Postgres World** has the best developer ergonomics (`createWebhook`), but by its own docs it is a reference implementation. You'd need to lock down the flow route yourself.
  4. **Restate** means running a stateful Restate server, or using Restate Cloud with unverified pricing.
  5. **Temporal** is overkill for one linear pipeline.
- **What "no idle compute" means on Railway.** On Railway you pay for an always-on worker service either way. What matters is that waiting doesn't tie up a worker slot or block deploys. Hatchet frees the slot, Restate suspends, Workflow SDK suspends, and DBOS persists the wait in Postgres, so it recovers after restarts.
- **If RankSEO stayed on Vercel.** Vercel Workflow would be very cheap at this volume: ~20–35 events per report gives ≈ 20–35k events per 1,000 reports, inside Hobby's 50k, or about $0.40–0.70 per 1,000 reports on Pro, plus function compute. That would replace both Trigger.dev and the separate worker deployable. The event-count assumption is mine.

### Gaps
- Hatchet's TypeScript durable-event API details, webhook ingestion semantics (the plan lists "100 webhooks", but the feature wasn't fetched), per-key concurrency, and the self-hosted footprint weren't verified.
- Restate's official pricing and license weren't verified from a primary source.
- DBOS queue features for per-user (partitioned) concurrency and its license weren't verified in this session.
- Temporal signals were not re-verified here. Waiting on an external callback through a signal is standard Temporal usage, but this is background knowledge.
- No independent production evidence was gathered for Workflow SDK's Postgres World, Hatchet, Restate or DBOS.

## 4. Do-it-yourself on Railway: Postgres-backed queues (pg-boss, graphile-worker) or BullMQ + Redis with a signed webhook endpoint

### Takeaway
A Postgres queue on Railway removes the orchestration vendor entirely. pg-boss and graphile-worker supply retries with backoff, deduplication keys, cron, dead-letter queues (pg-boss) and LISTEN/NOTIFY wake-ups. You still have to build:
- the webhook receiver (auth, gzip, 30-second acknowledgement, deduplication);
- a guarded report state machine;
- timeout and polling fallbacks against Bright Data's `/progress` API;
- per-user and global caps;
- a reconciler;
- progress fan-out to the browser;
- your own run visibility, since there is no hosted dashboard.

Realistic effort is roughly 1–2 engineer-weeks to build and harden, plus ongoing ops. This is my estimate, not a sourced figure.

### Cited Findings
- **pg-boss:**
  - "automatic retries with exponential backoff"
  - "dead letter queues with redrive"
  - "Queue storage policies to support a variety of rate limiting, debouncing, and concurrency use cases"
  - priority queues
  - cron and RRULE scheduling, plus job deferral
  - a pub/sub API for fan-out
  - SKIP LOCKED claiming ("Concurrent workers claim jobs without blocking each other")
  - LISTEN/NOTIFY low-latency delivery
  - OpenTelemetry
  - job-dependency workflows

  Requirements: "Node 22.12 or higher, or Bun" and "PostgreSQL 13 or higher". The README doesn't mention job expiration or timeouts. — [Indep./GitHub: timgit/pg-boss](https://github.com/timgit/pg-boss)
- **graphile-worker:**
  - LISTEN/NOTIFY gives "typically under 3ms from task schedule to execution".
  - Exponential backoff defaults to "25 attempts over ~3 days".
  - "Task de-duplication via unique `job_key`."
  - "Adding jobs to same named queue runs them in series."
  - Crontab-like scheduling with optional backfill.
  - Batch jobs.
  - "each job will execute at least once".

  — [Indep./OSS docs: graphile-worker](https://worker.graphile.org/docs)
- Postgres `NOTIFY` payloads must be "shorter than 8000 bytes" by default. Notifications "are not delivered until and unless the transaction is committed", and are only delivered between transactions. — [Primary: PostgreSQL docs, NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- Railway HTTP limits:
  - Requests "can run for up to 15 minutes if data keeps transferring", otherwise they close after 5 minutes with no data.
  - Idle HTTP/1.1 connections close after 60 s between requests.
  - Request bodies must finish uploading within 5 minutes.
  - WebSockets "can stay open indefinitely, even while idle".
  - 10,000 concurrent connections; about 11,000 RPS per domain; 32 KB combined header limit.

  — [Vendor: Railway public networking specs & limits](https://docs.railway.com/networking/public-networking/specs-and-limits)
- Bright Data delivery facts a DIY receiver must handle:
  - Auth is sent through the `auth_header` trigger parameter.
  - Payloads are gzipped unless `uncompressed_webhook=true`.
  - You must "Return a 200 within 30 seconds".
  - Retry count and interval are undocumented.
  - Payloads can reach 1 GB.
  - A `dca-collection-id` header carries the snapshot ID.
  - 14 source IPs are published for allowlisting.

  Details are in section 6. — [Vendor: Bright Data data delivery](https://docs.brightdata.com/products/scrapers/scrapers-library/data-delivery)
- [First-party] Failure modes a DIY build must design out, as seen in the current build:
  - Error rows scored as evidence.
  - `PENDING` rows with no run ID that are never reconciled.
  - Replaying a completed run more than 24 hours later flips it from `COMPLETED` to `FAILED`.
  - Unguarded progress writes that overwrite terminal statuses.
  - A 30 s abort that can start a second paid collection.

  — [ARCHITECTURE-REVIEW.md findings 6, 11, 18](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md)

### Inferences
**Components to build** (my design synthesis from the facts above):
1. A **webhook endpoint** that:
   - checks the `Authorization` value sent via `auth_header`, optionally against the IP allowlist;
   - gunzips the body, or the trigger sets `uncompressed_webhook=true`;
   - streams large bodies to storage;
   - inserts with a unique key on `dca-collection-id`/`snapshot_id`;
   - enqueues the next job and returns 200 well within 30 s.

   A simpler variant uses Bright Data's `notify` URL (status only) and downloads the snapshot inside a job.
2. A **state machine** on the `reports` table, with transitions written as `UPDATE … WHERE status IN (<non-terminal>)`.
3. **Timeouts.** When collection starts, enqueue a delayed "check snapshot" job at T+15 min (pg-boss `startAfter`, graphile `run_at`). It calls `GET /datasets/v3/progress/{id}` and downloads the data when ready, or cancels with `POST …/snapshot/{id}/cancel` when giving up.
4. **Idempotency.** Use a job key of `reportId:stage`. Write a "collection requested" row before calling `/trigger`. On an ambiguous `/trigger` timeout, reconcile with `GET /datasets/v3/snapshots` instead of re-triggering. Store the LLM result before marking the report complete.
5. **Poison messages.** pg-boss has a dead-letter queue; graphile-worker has max attempts. Add alerts.
6. **Concurrency.**
   - Per-user: an atomic active-report cap at the API, using a row lock or advisory lock in Postgres. This also fixes the review's quota race.
   - Global: worker concurrency or a pg-boss queue policy.
7. **Progress.** `NOTIFY report_progress, '<reportId>'` after each committed state change, with an SSE endpoint that re-reads the row (section 5).
8. A **reconciler cron** for stale reports.

**Assessment**
- BullMQ + Redis would add a Redis service on Railway and keep progress and data in two stores. On a Postgres-centric Railway stack, pg-boss or graphile-worker is the simpler choice. This is an inference; BullMQ itself was not researched.
- Ops burden and vendor count are the lowest of all options (Railway + Bright Data + the LLM provider). Build effort and the risk of subtle bugs are the highest, which is exactly the class of bugs the review found.

### Gaps
- BullMQ was not researched in this session: features, Pro-only group rate limits, pricing.
- pg-boss's current major version and release date weren't visible. Its job expiration and timeout semantics weren't confirmed from the README.
- graphile-worker's locked-job recovery timeout and version requirements weren't on the fetched page.
- No measured or published effort data exists for a DIY build. The 1–2 week estimate is unsourced.

## 5. Realtime progress to the browser: Trigger.dev realtime hooks, Inngest Realtime, SSE from a long-running Node server, Postgres LISTEN/NOTIFY, Supabase/InsForge realtime channels

### Takeaway
At RankSEO's update rate (a handful of status changes per report), any of these channels works. The deciding factors are reconnect behavior, auth scoping, connection caps and vendor count:
- **Vendor hooks.** Trigger.dev and Inngest are zero-build but tied to their platforms and capped per plan: Trigger.dev Hobby 150 connections, Inngest Free 50.
- **SSE on Railway** with Postgres LISTEN/NOTIFY needs no vendor. It must survive Railway's 15-minute request cap and 5-minute idle cut with heartbeats and client reconnects.
- **Supabase and InsForge channels** come with their BaaS and enforce access through RLS.

In every case, the database row should stay the source of truth, with polling as a fallback.

### Cited Findings
- **Trigger.dev:**
  - Run updates come through Electric SQL with `useRealtimeRun`; streams through `useRealtimeStream`. All realtime calls need auth (public access tokens). — [Vendor: Trigger.dev Realtime](https://trigger.dev/docs/realtime/overview)
  - Concurrent connections: Free 10, Hobby 150, Pro 1,000+. — [Vendor: pricing](https://trigger.dev/pricing)
  - Self-hosted installs bundle s2-lite for realtime streams v2. — [Vendor: Docker self-hosting](https://trigger.dev/docs/self-hosting/docker)
- **Inngest Realtime:**
  - Channels and topics. `step.realtime.publish` is durable, so it isn't resent on retry. Subscription tokens are minted by your server and scoped to a channel and topics. The React hook is `useRealtime`. — [Vendor: Inngest Realtime](https://www.inngest.com/docs/features/realtime)
  - Free: 50 connections and 250k messages/day. Pro: 1,000 and 1M/day. — [Vendor: Inngest pricing](https://www.inngest.com/pricing)
- **SSE on Railway.** An SSE response is an HTTP request. Requests run up to 15 minutes while data keeps transferring and close after 5 minutes with no data. WebSockets are exempt and "can stay open indefinitely". There is a cap of 10,000 concurrent connections. — [Vendor: Railway specs & limits](https://docs.railway.com/networking/public-networking/specs-and-limits)
- **Postgres LISTEN/NOTIFY.** Payloads are under 8000 bytes. Notifications are delivered only after commit. A listener stuck in a long transaction blocks queue cleanup; the queue is 8 GB. — [Primary: PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- **Supabase Realtime limits:**

  | Plan | Concurrent connections | Messages/s |
  |---|---|---|
  | Free | 200 | 100 |
  | Pro | 500 | 500 |
  | Pro (no spend cap) | 10,000 | 2,500 |
  | Team | 10,000 | 2,500 |

  Broadcast payloads are 256 KB on Free and 3,000 KB on paid plans. Broadcast replay is retained for 72 hours, with 25 messages per request. When the 1,024 KB Postgres Changes payload limit is exceeded, only fields of 64 bytes or less are kept. — [Vendor: Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- **InsForge Realtime.** Clients subscribe to declared channels such as `order:123` and receive database changes, broadcasts and presence over WebSockets. Access is controlled by RLS on the realtime tables. Webhook URLs can be attached per channel. No limits were found. — [Vendor: InsForge realtime overview](https://docs.insforge.dev/core-concepts/realtime/overview.md); [Vendor: InsForge Real-time blog](https://insforge.dev/blog/insforge-realtime) (via search summaries)
- **Workflow SDK.** On Vercel, "Real-time connections: No limit" and stream chunks up to 10 MB. The Postgres World streams over LISTEN/NOTIFY and re-reads persisted chunks after a dropped connection. — [Vendor: Vercel Workflow pricing/limits](https://vercel.com/docs/workflows/pricing); [Vendor: Postgres World](https://workflow-sdk.dev/worlds/postgres)

### Inferences
| Channel | Build effort | Extra vendor | Main risk | Fits (a) Railway / (b) BaaS |
|---|---|---|---|---|
| Trigger.dev `useRealtimeRun` (run metadata) | Lowest | Yes (Trigger.dev) | Plan connection caps; failure-UI bugs seen in current build | (a) if keeping Trigger.dev |
| Inngest `useRealtime` | Low | Yes (Inngest) | Free: 50 connections; replay semantics undocumented | (a) with Inngest |
| SSE from Railway Node + LISTEN/NOTIFY | Medium (endpoint, auth via Better Auth session, heartbeats, reconnect with `Last-Event-ID`, a dedicated LISTEN connection) | No | 15-min/5-min-idle request rules; scaling the fan-out across replicas (each replica holds one LISTEN connection) | (a) |
| WebSocket on Railway | Medium-high | No | More code than SSE, but exempt from the HTTP duration limits | (a) |
| Supabase Realtime (Postgres Changes or Broadcast) | Low | No (part of BaaS) | Plan caps; RLS policy correctness | (b) |
| InsForge Realtime channels | Low | No (part of BaaS) | Limits undocumented; young platform | (b) |
| Plain polling (current fallback) | Lowest | No | Load; latency (3 s today) | both |

- The status row in Postgres should remain authoritative, with the realtime channel only as a "nudge". That makes every channel above safe to drop or reconnect, and it fixes the review's "subscription error shows failure" bug class.
- For LISTEN/NOTIFY, send only the report ID, since payloads must stay under 8000 bytes. The listener needs a dedicated persistent connection. It should not go through a transaction-mode pooler. This is an inference: the NOTIFY page implies it, but no pooler-specific statement was found.

### Gaps
- No fetched source documents Railway behavior for SSE specifically, beyond the general HTTP rules.
- Trigger.dev and Inngest realtime message-size and stream-duration limits weren't documented on the fetched pages.
- InsForge realtime connection and message limits, and its pricing, weren't found.
- Supabase's per-connection and per-message overage pricing wasn't on the limits page.

## 6. Bright Data specifics: webhook delivery behavior, error rows, the snapshot progress/polling API, and pricing for ChatGPT, Gemini and Perplexity scrapers

### Takeaway
Treat Bright Data's webhook as a hint and the snapshot API as the source of truth:
- Deliveries are gzipped by default, must be acknowledged within 30 s, and are retried an undocumented number of times.
- Snapshots stay downloadable for 30 days.
- A `/progress` endpoint reports `starting`, `running`, `ready`, `failed` or `canceled`.

That means a 15-minute wait can always fall back to polling and downloading by `snapshot_id`. Pricing is about **$1.50 per 1,000 records** pay-as-you-go for the AI scrapers, the same rate for ChatGPT, Perplexity and Gemini. A 15-record visibility report therefore costs about $0.02 in scraping. There is a conflict over whether failed or error records are billed.

### Cited Findings
**Delivery parameters**
- On `/datasets/v3/trigger`:
  - `endpoint`: Bright Data POSTs the data there when the job completes.
  - `auth_header`: sent as the `Authorization` header on every delivery. "The older name `webhook_header_Authorization` is ignored by the API."
  - `uncompressed_webhook=true` sends plain JSON.
  - `format`: json, ndjson, jsonl or csv.

  — [Vendor: Bright Data data delivery](https://docs.brightdata.com/products/scrapers/scrapers-library/data-delivery). **Conflict:** per-scraper pages, such as the ChatGPT and Google webhook pages, still show `webhook_header_Authorization`. — [Vendor: ChatGPT webhooks page](https://docs.brightdata.com/datasets/scrapers/chatgpt/data-delivery/webhooks); [Vendor: Google webhooks page](https://docs.brightdata.com/datasets/scrapers/google/data-delivery/webhooks)

**Acknowledgement, retries, size and headers**
- "If you omit `uncompressed_webhook=true`, data arrives gzip-compressed."
- Return a 200 "within 30 seconds to acknowledge receipt". If delivery fails, "Bright Data retries delivery", with no count or interval given.
- Payloads can reach 1 GB, and S3 is recommended for very large data.
- Delivery headers include `dca-collection-id` (the snapshot ID, recommended for matching) and `dca-filename`. The `User-Agent` starts with `BRD dca-stage-deliver`.
- 14 source IPs are listed for allowlisting.
- "snapshots stay available for 30 days". If a webhook fails, download by `snapshot_id`.
- Cloud delivery to S3, GCS, Pub/Sub, Azure, Snowflake and SFTP is also available.

— [Vendor: data delivery](https://docs.brightdata.com/products/scrapers/scrapers-library/data-delivery)

**Notify URL, error records, cancelling and file limits**
- The `notify` URL gets "the snapshot ID and its status, not the data". The `endpoint` URL "receives the data itself as soon as the snapshot is ready".
- An empty snapshot "still contains error records that explain why". Add `include_errors=true` to see them.
- "Records that fail because the input was incorrect are still billed."
- To cancel: `POST /datasets/v3/snapshot/{snapshot_id}/cancel`. "A canceled snapshot delivers no data, and a snapshot that has finished collecting cannot be canceled."
- Each delivered file has a hard 5 GB limit.
- A synchronous request waits up to 1 minute.

— [Vendor: Bright Data scrapers FAQ](https://docs.brightdata.com/products/scrapers/scrapers-library/faqs)

**Progress and polling API**
- `GET https://api.brightdata.com/datasets/v3/progress/{snapshot_id}` with a Bearer API key returns `snapshot_id`, `dataset_id` and `status`. Status is one of `starting`, `running`, `ready`, `failed` or `canceled`.
- Failure messages include "Account is suspended", "Snapshot is empty" and "Failed to deliver snapshot".
- No polling rate limit is documented.
- A synchronous `/scrape` that exceeds 1 minute returns a `snapshot_id` to poll.

— [Vendor: Monitor Progress API](https://docs.brightdata.com/api-reference/scrapers/management-apis/monitor-progress.md)
- `GET /datasets/v3/snapshots` lists triggered collections and can filter by status (running, ready, failed). Older Marketplace API docs show a conflicting status of "collecting". — [Vendor: management APIs](https://docs.brightdata.com/api-reference/scrapers/management-apis); [Vendor: Marketplace status API](https://docs.brightdata.com/api-reference/marketplace-api/status-of-a-collection-based-on-snapshot_id.md) (via search summary)

**Pricing**
- AI scrapers (Scraper API), from a page modified 2026-10-07:

  | Tier | Price |
  |---|---|
  | Pay-as-you-go | "$1.5/1K record", "Billed only for success", "unlimited concurrency" |
  | Scale | "$499 /month" for 384,000 records, then "$1.3/1K additional records" |
  | Free | "5K records per month" (about $7.50 of credit, no rollover) |
  | Enterprise | custom |

  The page lists no per-engine price differences. "Pay only for success… no charges for failed deliveries." — [Vendor: Bright Data AI Web Scraper](https://brightdata.com/products/web-scraper/ai). **Conflict:** the FAQ says records that fail because of incorrect input are still billed ([Vendor: FAQ](https://docs.brightdata.com/products/scrapers/scrapers-library/faqs)).
- Inputs per scraper:
  - ChatGPT: `url, prompt, country, additional_prompt, web_search, geolocation`.
  - Perplexity: `url, prompt, country, index, additional_prompt`.
  - Gemini: `url, prompt, index`. **No `country` field appears in the example.**
  - Google AI Mode and Copilot are also offered.

  — [Vendor: Bright Data AI Web Scraper](https://brightdata.com/products/web-scraper/ai)
- Third-party comparisons: Apify's ChatGPT Search Actor starts at $3 per 1,000 searches, and DataForSEO lists Gemini results at $1.20 per 1,000. Both come from affiliate or vendor blogs, including Bright Data's own. — [Indep.: DEV Community ChatGPT scraper pricing](https://dev.to/natalie_chen/cheapest-chatgpt-scraper-apis-in-2026-pricing-guide-3o9e); [Vendor-biased: Bright Data blog on Gemini scrapers](https://brightdata.com/blog/ai/best-gemini-scrapers.md)
- [First-party] The current tasks request `include_errors`, `force_deliver` and the `error` fields, then only check that the array is non-empty. As a result, a run where Gemini blocks all 5 prompts can still be saved as `COMPLETED`. — [ARCHITECTURE-REVIEW.md finding 6](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md)

### Inferences
- **Engine-agnostic delivery pattern.**
  1. Trigger the collection and persist `snapshot_id` at once.
  2. Use `notify` for small status pings, or `endpoint` with `uncompressed_webhook=true` and an `auth_header` secret.
  3. On any signal, or on a timer at T+15 min, call `/progress` and download the snapshot.
  4. Validate the rows with Zod and **drop and count error rows**.
  5. Mark the report partial or failed below a threshold, and use the count of answered rows as the denominator.

  This fixes findings 6 and 18 on any orchestrator.
- **Trigger.dev waitpoints.** Since the waitpoint URL carries data as the token output, the gzip default and payload size matter. Setting `uncompressed_webhook=true` is required unless the token endpoint accepts gzip, which wasn't verified. Switching to `notify` keeps token outputs tiny.
- **Cost per report.** A keyword report (1 record) costs about $0.0015 in scraping. A visibility report (5 prompts × 3 engines = 15 records) costs about $0.0225 at pay-as-you-go. Scraping is about 20–50% of the Claude cost per report (section 7).
- **Gemini and country.** If the Gemini scraper truly has no `country` input, RankSEO's country selection can't be honored for Gemini. Verify this against the Gemini dataset docs.

### Gaps
- The webhook retry count, backoff, and whether retries run after a 30 s acknowledgement timeout are undocumented.
- Whether Bright Data offers HMAC signing of deliveries, as opposed to a static Authorization header, wasn't found.
- No idempotency key exists or is documented for `/trigger`.
- No published per-account trigger concurrency limit was found; pay-as-you-go claims "unlimited concurrency".
- The billing treatment of blocked or error rows for the AI scrapers conflicts between the product page and the FAQ. Confirm with Bright Data.
- The exact format of error rows (`error` / `error_code` fields) wasn't documented on the fetched pages.

## 7. LLM access: Vercel AI Gateway vs OpenRouter vs direct Anthropic API vs an InsForge-style built-in gateway; using the AI SDK off Vercel

### Takeaway
For a Claude-only pipeline with one structured call per report, **calling Anthropic directly** through `@ai-sdk/anthropic` or the Anthropic SDK removes a critical-path vendor. It also gives first-class structured outputs, which are GA as `output_config.format` and strict tools, at list prices: Sonnet 4.6 at $3/$15 per MTok, and Sonnet 5 / 5.5 at $2/$10.

**Vercel AI Gateway** charges no markup and no fee even with your own provider key (BYOK). It works from any host with an API key. It adds provider failover across Anthropic, Bedrock, Vertex and Claude Platform on AWS, plus spend budgets and observability, so it is the best choice if failover is wanted.

**OpenRouter** adds a 5.5% fee on credit purchases.

**InsForge's Model Gateway** proxies through OpenRouter with per-project caps. Its pricing is undocumented and its docs are in flux.

### Cited Findings
**Vercel AI Gateway**
- "AI Gateway charges no markup and no platform fee on tokens. You pay the provider's list price." BYOK has "no markup or fee", but requires purchased credits. A failed BYOK request is retried with system credentials and billed to your credits. "You're responsible for any payment processing fees."
- Opt-in add-ons:
  - Custom reporting: $0.075 per 1,000 writes and $5 per 1,000 queries.
  - Team-wide ZDR: $0.10 per 1,000 requests. Per-request ZDR is free on Pro and Enterprise.
  - Team-wide provider allowlist: $0.10 per 1,000 requests.
  - Trace drains: $0.05 per 1,000 traces and $0.50/GB.
- Budgets can be set per team, project, API key or user.

Page last updated 2026-09-08. — [Vendor: AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing)
- "AI Gateway does not rate limit paid-tier requests." The free tier has lower per-model limits. A 429 may come from the upstream provider. Budget exhaustion returns 402 `quota_for_entity_exceeded`. The AI SDK's `maxRetries` defaults to 2. Page last updated 2026-09-08. — [Vendor: AI Gateway rate limits](https://vercel.com/docs/ai-gateway/rate-limits)
- Routing:
  - `providerOptions.gateway` takes `order`, `only` and `sort` (by cost, ttft or tps).
  - Model fallbacks and per-provider timeouts give fast failover.
  - `caching: 'auto'` adds Anthropic cache markers.
  - Request-scoped BYOK is supported.
  - Claude-capable providers in the list include `anthropic`, `bedrock`, `vertex` and `claudeaws` (Claude Platform on AWS).
  - The examples use **AI SDK 7** with `AI_GATEWAY_API_KEY` against `https://ai-gateway.vercel.sh`, which also exposes OpenAI-compatible, Anthropic Messages and Responses endpoints.

  Page last updated 2026-10-02. — [Vendor: AI Gateway provider routing & fallbacks](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options)
- [First-party] RankSEO already calls AI Gateway from Trigger.dev workers, which are **off Vercel**, using `AI_GATEWAY_API_KEY`. The AI SDK and Gateway therefore already work from a non-Vercel host. — [CODEMAPS/dependencies.md](/home/user/AISEO/docs/rankseo-review/CODEMAPS/dependencies.md)

**OpenRouter**
- "OpenRouter charges a 5.5% ($0.80 minimum) fee when you purchase credits". Crypto purchases carry a 5% fee.
- BYOK has a 5% fee above an allowance measured in list-price inference cost. The page states the pay-as-you-go allowance as $25,000/month with no BYOK fee.
- There is no markup on inference pricing.
- Automatic fallback to the next provider on errors.
- Credits may expire after one year.
- Opting in to prompt logging gives a 1% discount.

— [Vendor: OpenRouter FAQ](https://openrouter.ai/docs/faq)
- Structured outputs are supported per endpoint ("Support is determined per endpoint, not just per model"). Use `require_parameters: true` to route only to compliant providers. Strict compliance "is not guaranteed on every endpoint". The page doesn't explicitly confirm Claude support. — [Vendor: OpenRouter structured outputs](https://openrouter.ai/docs/features/structured-outputs)
- A third-party guide describes the fee as "5.5% platform fee on pay-as-you-go usage". The official FAQ says it applies to credit purchases. — [Indep.: DeployHQ OpenRouter guide](https://www.deployhq.com/blog/openrouter-practical-guide-teams)

**Direct Anthropic**
- Structured outputs are GA with no beta header. `output_format` moved to `output_config.format`; the old parameter needs the `structured-outputs-2025-11-13` beta header, or the API returns a 400.
- Supported models include Sonnet 4.6, Sonnet 5, Sonnet 5.5, Opus 4.6–5.5, and Haiku 4.5 and 5.5.
- There are two modes, JSON outputs and strict tool use (`strict: true`), which can be combined.
- Unsupported schema features return a 400: recursive schemas, numeric and string-length constraints, `minItems` above 1, and `additionalProperties` other than `false`.
- The first use of a schema adds grammar-compilation latency, and compiled grammars are cached for 24 hours from last use.
- Complexity limits: 20 strict tools and 24 optional parameters per request, with a 180 s compile timeout.
- A refusal (`stop_reason: "refusal"`) or `max_tokens` stop may produce output that doesn't match the schema.
- On Amazon Bedrock, structured outputs are GA only on the legacy integration (Opus 4.6 / Sonnet 4.6 and earlier).

— [Vendor: Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Pricing per MTok:

  | Model | Input | Output |
  |---|---|---|
  | Claude Sonnet 4.6 (current RankSEO model) | $3 | $15 |
  | Sonnet 5 | $2 | $10 |
  | Sonnet 5.5 | $2 | $10 (cache reads $0.20) |
  | Haiku 5.5 | $0.10 | $0.50 (prompts up to 100K tokens) |

  The Message Batches API runs at 50% of cost. Sonnet 5.5 rejects forced `tool_choice` (`any`/`tool`) with a 400, and `thinking: {type: "disabled"}` returns a 400 (use `between_tools`). — [Vendor: Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) and [migration guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide.md), taken from the Claude API reference skill's model table (cached 2026-10-06); the pricing page itself was not fetched in this session.

**AI SDK Anthropic provider**
- `structuredOutputMode` is `"outputFormat"` (native), `"jsonTool"` (a forced `json` tool) or `"auto"` (the default: native where supported, falling back to the tool). Sonnet 5.5, Opus 5.5 and Fable 5.1 use native output in auto mode. "These models reject forced tool use, so the "jsonTool" mode cannot be used with them". A required or named `toolChoice` "is downgraded to `auto` with a warning". — [Vendor: AI SDK Anthropic provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic)

**InsForge Model Gateway**
- An OpenAI-compatible endpoint at `https://<project>.insforge.dev/v1`. InsForge "holds the provider keys, tracks usage per project, and routes traffic through OpenRouter".
- Each project has its own rate limit and spend cap, returning 429 when hit.
- "Every request is logged with model, token count, and cost". Billing "reconcile[s] to OpenRouter's invoice".
- The page doesn't mention pricing, markup or structured outputs.

— [Vendor: InsForge AI overview](https://docs.insforge.dev/core-concepts/ai/overview)
- A search snippet from InsForge's AI architecture page said the older InsForge AI proxy endpoints are deprecated and that "New AI integrations should call OpenRouter directly with the OpenRouter key provisioned by InsForge". That page returned **404** on 2026-10-12, so the docs are in flux. — [Vendor: InsForge AI architecture (404 at fetch)](https://docs.insforge.dev/core-concepts/ai/architecture)

### Inferences
**Comparison for RankSEO** (synthesis):

| Path | Token markup | Extra fees | Claude structured outputs | Failover | Observability / spend caps | Critical-path vendors added |
|---|---|---|---|---|---|---|
| Direct Anthropic (`@ai-sdk/anthropic` or Anthropic SDK) | none | none | Native GA (`output_config.format`, strict tools) | DIY (e.g., second provider in code: Bedrock/Vertex SDK) | Anthropic Console usage; your own logs; workspace limits | 0 |
| Vercel AI Gateway (paid tier or BYOK) | none | card processing fees; optional add-ons | Passes Anthropic provider options through (structured-output passthrough via AI SDK not explicitly verified) | Built-in `order`/`only`/model fallbacks/timeouts across anthropic, bedrock, vertex, claudeaws | Budgets (402), logs, OTel trace drains (paid) | +1 (Vercel) |
| OpenRouter | none on inference | 5.5% on credit purchases (min $0.80); 5% BYOK above allowance | Per-endpoint; strictness not guaranteed on every endpoint | Automatic provider fallback | Usage logs; 1% discount if you allow prompt logging | +1 |
| InsForge Model Gateway | undocumented | undocumented (bills via OpenRouter) | Through OpenRouter's OpenAI-compatible layer; not documented | Via OpenRouter | Per-project caps, 429s, cost logs | +1–2 (InsForge proxy + OpenRouter) |

**Other points**
- **Cost per report (illustrative).** Assume 10–20k input and 1.5–3k output tokens (my assumption; real token counts weren't measured). Sonnet 4.6 costs ≈ $0.05–0.11 per report; Sonnet 5.5 costs ≈ $0.035–0.07. The LLM is the largest variable cost, ahead of Bright Data (~$0.02) and orchestration (~$0.003).
- **Model upgrade.** Moving to Sonnet 5.5 cuts the price by about a third. Because it rejects forced tool use, keep the AI SDK's `structuredOutputMode` at `auto` or `outputFormat`. Keep local Zod validation too: Anthropic strips numeric and length constraints from schemas, and refusals or `max_tokens` stops can break the schema.
- **Using the AI SDK off Vercel.** It is a plain library, so it works on Railway or any host, either with `@ai-sdk/anthropic` and `ANTHROPIC_API_KEY` or through the gateway with `AI_GATEWAY_API_KEY`. RankSEO's workers already do this.
- **Option (b), InsForge.** Using InsForge's gateway would route Claude through InsForge and OpenRouter's OpenAI-compatible layer. Native Anthropic features such as `output_config.format`, strict tools and cache control depend on OpenRouter's translation. A direct Anthropic call from an InsForge edge function or Compute service avoids that.

### Gaps
- Whether the AI SDK's native structured-output mode is used for Sonnet 4.6 specifically isn't stated. The AI SDK page names only the 5.x models.
- Whether AI Gateway passes `output_config.format` through unchanged wasn't explicitly verified.
- The AI Gateway free-tier monthly credit amount isn't stated on the pricing page.
- OpenRouter's paid-account rate limits are on a separate page that wasn't fetched.
- Anthropic's rate-limit tiers weren't fetched.
- InsForge's gateway pricing or markup and its structured-output support are undocumented.
- The Anthropic pricing page wasn't fetched directly. Prices come from the Claude API reference skill's cached table (2026-10-06).

## 8. Fit with (a) a composed stack on Railway (Better Auth + Postgres) vs (b) an all-in-one backend (InsForge) or BaaS (Supabase), and the trade-off table (vendor count, ops burden, cost at small scale, lock-in, maturity)

### Takeaway
**(a) Railway + Better Auth + Postgres** has three realistic shapes:
1. Keep **Trigger.dev Cloud**. This is the least rebuild work at about $10/month, but keeps one orchestration vendor, and compute runs outside Railway.
2. Move to **Inngest Cloud**. Compute stays next to Postgres and the lifecycle events are better, but Pro costs $99/month or more.
3. **No orchestration vendor**: DBOS, or pg-boss/graphile-worker, plus a Bright Data polling fallback and SSE. This has the fewest vendors, the lowest lock-in and the most code.

**(b) Supabase and InsForge** give realtime, cron and functions, but **no durable "wait for webhook" primitive** was found in either. Supabase Edge Functions stop at 150 s (Free) or 400 s (paid), and InsForge positions Edge Functions for "short-lived jobs". The pipeline therefore becomes an event-driven state machine you build on their primitives (webhook → function → database → cron reconciler), or you add Trigger.dev or Inngest back as a vendor.

### Cited Findings
- **Railway plans:**

  | Plan | Fee | Included usage | Max per service |
  |---|---|---|---|
  | Free | $0 | $1/month | 1 vCPU / 0.5 GB |
  | Hobby | $5/month | $5 | 48 vCPU / 48 GB |
  | Pro | $20/workspace | $20 | 1,000 vCPU / 1 TB |

  Usage rates: CPU $0.00000772 per vCPU-second (≈ $20 per vCPU-month); memory $0.00000386 per GB-second (≈ $10 per GB-month); volumes ≈ $0.15/GB-month; egress $0.05/GB; object storage $0.015/GB-month with free egress. — [Vendor: Railway pricing](https://railway.com/pricing)
- **Supabase Edge Functions.** The wall-clock limit is 150 s on Free and 400 s on paid plans. CPU is limited to 2 s per request, excluding async I/O. Background tasks via `EdgeRuntime.waitUntil` run until the wall-clock limit. Exceeding it returns 546 errors. Longer jobs are commonly chunked through pgmq queues and pg_cron (a community pattern; pgflow's edge worker is labeled a proof of concept). — [Vendor: Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits); [Vendor: Supabase background tasks](https://supabase.com/docs/guides/functions/background-tasks); [Indep.: GitHub discussion #21293](https://github.com/orgs/supabase/discussions/21293); [Indep.: pgflow edge-worker](https://jsr.io/@pgflow/edge-worker@0.2.0); [Indep.: DEV tutorial](https://dev.to/suciptoid/build-queue-worker-using-supabase-cron-queue-and-edge-function-19di)
- **InsForge functions:**
  - Deno TypeScript functions triggered over HTTP, by database row events (with a service-role JWT) or by cron.
  - "Edge Functions are for request/response and short-lived jobs". **Compute** is for "queue workers, AI inference loops, and anything stateful".
  - Scheduled runs retry "on failure", with no count given. No execution timeout is published.

  — [Vendor: InsForge functions overview](https://docs.insforge.dev/core-concepts/functions/overview)
- InsForge schedules use pg_cron, which makes HTTP requests to function endpoints. Cron expressions have 5 fields, with no seconds. — [Vendor: InsForge schedules](https://docs.insforge.dev/core-concepts/functions/schedules) (via search summary)
- [First-party] The review records that "three SaaS vendors sit in the critical path (Trigger.dev, Bright Data, AI Gateway)", that the app is two deployables with separate environment sets, and that "The binding constraints are third-party cost and quotas… not compute". — [ARCHITECTURE-REVIEW.md ADR-1 and scaling notes](/home/user/AISEO/docs/rankseo-review/ARCHITECTURE-REVIEW.md)

### Inferences
**Trade-off table** (my synthesis; numbers link to the sections above). Assumptions: about 1,000 reports/month, with the LLM and Bright Data costs (~$0.05–0.11 and ~$0.02 per report) common to every row and excluded. "Critical-path vendors" counts services a report depends on beyond the app host and database, and always includes Bright Data and Anthropic.

| Option | Critical-path vendors | Ops burden | Orchestration cost at ~1k reports/mo | Lock-in | Maturity (Oct 2026) | Webhook wait without idle compute |
|---|---|---|---|---|---|---|
| (a) Railway app + **Trigger.dev Cloud** (+ direct Anthropic) | 3 (Trigger.dev, Bright Data, Anthropic); 4 if AI Gateway is kept | Low (managed; separate deploy + env set; reconciler still needed) | Hobby $10/mo covers ≈ $2–4 compute | Medium (task SDK, waitpoints, realtime hooks; Apache-2.0 but self-host lacks checkpoints) | High: v4.7.x, frequent releases, 16.5k stars, waitpoint callbacks since May 2025 | Yes (Cloud checkpoints) |
| (a) **Trigger.dev self-hosted** on Railway (+ VM for supervisor) | 2 + Railway + VM host | High (ClickHouse, Redis, registry, object storage, supervisor off-Railway, community support only) | Upper bound ≈ $280/mo for the recommended specs on Railway | Low-medium | Medium (official, but "no checkpoint support" and the guide isn't production-ready) | **No** (no checkpoints; waits hold containers) |
| (a) Railway app + **Inngest Cloud** | 3 | Low (functions in your Railway app via `serve()` or `connect()`) | Free (50k executions, 5 concurrent steps, 24 h traces) or Pro from $99/mo | Medium (step API; server is SSPL) | High for cloud; self-host since Sep 2024 | Yes (`waitForEvent` holds no slot) |
| (a) **Inngest self-hosted** on Railway (+ Postgres/Redis) | 2 | Medium (single binary, but no auto-cleanup, unauthenticated metrics, no support guarantee) | Railway compute only (est. ~$10–30/mo) | Medium (SSPL server) | Medium | Yes |
| (a) **Workflow SDK + Postgres World** on Railway | 2 | Medium (reference implementation; secure the flow route yourself) | Railway compute only | Low-medium (portable Worlds) | Low off Vercel; GA on Vercel since Apr 2026 | Yes (`createWebhook` suspends) |
| **Vercel Workflow on Vercel** (if staying on Vercel) | 3 (Vercel, Bright Data, Anthropic) | Low | ≈ 20–35k events (inside Hobby's 50k) or <$1/mo on Pro, plus function compute | Medium-high (Vercel World) | Medium (GA since Apr 2026) | Yes |
| (a) Railway workers + **Hatchet Cloud** | 3 | Low-medium | $0 (1M runs/mo included) plus Railway worker compute | Low-medium (MIT; self-hostable) | Medium | Yes (slot freed while waiting) |
| (a) **Restate** (Cloud or self-hosted server) | 2–3 | Medium (stateful server if self-hosted) | Unverified (third-party: free 50k actions/mo) | Medium (BSL per third party) | Medium-low | Yes (awakeable suspends) |
| (a) **DBOS** library on Railway Postgres | 2 | Low-medium (library; build webhook route, SSE, reconciler) | $0 (open source); Conductor Pro $99/mo optional | Low (your Postgres) | Medium | Yes, logically (`recv` persisted; process must be up) |
| **Temporal Cloud** | 3 | Medium (SDK and worker model) | $50 per million actions pay-as-you-go ($150 starting credit); Business from $500/mo | Medium-high | Very high | Yes |
| (a) **DIY pg-boss / graphile-worker** on Railway Postgres | 2 | Medium-high (you own every failure mode) | Railway compute only (a worker service, est. ~$5–20/mo) | Lowest | Libraries mature; your pipeline is new code | Yes (poll and delayed jobs; no held compute) |
| (b) **Supabase-native** (Edge Functions + pgmq/pg_cron + Realtime) | 2 (+ Supabase as host) | Medium (event-driven state machine; 400 s function cap) | Supabase plan fee (not researched here) | Medium-high (Deno functions, Supabase APIs; Supabase itself is open source, not verified here) | High platform, but no durable-wait primitive | Only by splitting into webhook-triggered functions |
| (b) **InsForge-native** (Edge Functions/Compute + schedules + Realtime + Model Gateway) | 3–4 (+ InsForge as host; OpenRouter if using its gateway) | Medium (no durable-wait primitive found; docs in flux) | Not researched here | High (InsForge APIs, gateway via OpenRouter) | Low-medium (young; AI docs page 404 at fetch) | Only by splitting into webhook-triggered functions or a Compute worker |

**Key judgments**
- On vendor count, the review's "three vendors in the critical path" drops to two (Bright Data and Anthropic) only with DBOS, a DIY queue, Workflow SDK's Postgres World, or self-hosted Inngest on Railway, all calling Anthropic directly. Every managed orchestrator adds one vendor back.
- On rebuild effort versus risk, keeping Trigger.dev Cloud while fixing the review findings is the smallest change: idempotency keys, Zod-validated deliveries, a reconciler, `concurrencyKey`, a polling fallback and `key={runId}`. Inngest offers the best built-in hooks for the cancelled and failed runs that Trigger.dev's lifecycle hooks miss. DBOS or a DIY queue is the best fit for the "single Railway project + Postgres" goal and for low lock-in.
- For option (b), neither InsForge nor Supabase removes the need to build the waiting logic. Their realtime and cron features are an advantage, but the long-wait orchestration must be redesigned as callbacks plus a cron reconciler. That is effectively the DIY design from section 4 on their primitives. The alternative is pairing them with Trigger.dev or Inngest, which restores the vendor count.
- On predictable cost, every option's orchestration cost is small next to the LLM and scraping costs at this scale. Spend predictability comes mainly from per-user and global concurrency caps, atomic quota reservation and AI Gateway or Anthropic budgets, not from the job runner.

### Gaps
- Supabase plan pricing, the official Supabase Queues (pgmq) docs, and Supabase's self-hosting status weren't fetched here. Another researcher may cover them.
- InsForge pricing, Compute limits and timeouts, Edge Function timeouts, and whether InsForge offers any durable workflow or queue primitive weren't found.
- Railway costs for each option are estimates from per-second rates, not measured usage.
- No independent, practitioner-written production comparison of these options for a webhook-wait plus LLM pipeline was found. Search results were dominated by SEO comparison blogs with pricing errors.
