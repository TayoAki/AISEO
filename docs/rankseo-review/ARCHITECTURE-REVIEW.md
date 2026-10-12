# RankSEO: Architecture Review

> **Reviewed:** [TechWithEmmaYT/AI-SEO-Marketing-SaaS-App](https://github.com/TechWithEmmaYT/AI-SEO-Marketing-SaaS-App) @ `de4843f`, 2026-10-12
> **Harness:** [affaan-m/ECC](https://github.com/affaan-m/ECC) @ `b92f181`. How each ECC piece was applied is in the [appendix](#appendix-how-the-ecc-harness-was-applied).
> **Codemaps:** [architecture](CODEMAPS/architecture.md) · [backend](CODEMAPS/backend.md) · [workers](CODEMAPS/workers.md) · [frontend](CODEMAPS/frontend.md) · [data](CODEMAPS/data.md) · [dependencies](CODEMAPS/dependencies.md)
> **License:** the code is under the TechWithEmma license. It is free for personal learning and portfolio use. Deploying it as a SaaS, earning revenue with it, or redistributing it requires a paid commercial license.

## Verdict

RankSEO is a small, modern monolith: about 2.4k lines of backend and 5k lines of UI. Its
async backbone is well chosen. Thin Next.js routes create a `Report` and hand off to durable
Trigger.dev tasks. Those tasks park on waitpoint tokens until Bright Data's webhook delivers,
use Claude only to *structure* the collected evidence, and recompute the metrics in code. Every
report read is scoped to its owner. **The architecture is sound and worth keeping.**

**The code is not production-ready.** At the reviewed commit it does not even build. In order:

1. **The build is broken.** `components/site-header.tsx` uses hooks without `"use client"` and is
   rendered by Server Components, so `next build` fails. Typecheck and lint both pass and can't
   catch it. The mobile navigation menu also crashes as soon as it opens.
2. **The paywall is UI-only.** Paid sections reach every free user's browser through the report
   API and the Trigger.dev run output. `FeatureLock` only hides them.
3. **Spend is unbounded.** Sign-up needs no email verification, the free quota is per account,
   the money-spending routes have no rate limit, and the quota check is a racy count-then-create.
   Every report costs Bright Data records plus Claude calls.
4. **The pipelines can silently produce wrong reports.** Bright Data error rows are scored as
   real evidence; for example, a blocked Gemini scrape is reported as "Hidden, 0 %". A
   visibility retry pairs regenerated prompts with answers collected for the original prompts.
5. **There are known-critical framework CVEs and no tests.** `next@16.2.12` is affected by Image
   Optimization RCE and SSRF advisories (fixed in 16.4.0), and the repo has zero automated tests.

## 1. What the system is

Two products share one pipeline shape:

| Product | Input | External work | Output |
|---------|-------|---------------|--------|
| AI Keyword Research `/ai-keyword` | keyword + country (a language picker exists but is dropped) | 1 Bright Data Perplexity scrape → 1 Claude structured call | opportunity score, top cited domains, source mix, competitors, prompt ideas, keyword clusters, *paid*: summary insights + content opportunities |
| AI Search Visibility `/ai-search-visibility` | website + brand + topic | 1 Claude call (5 neutral prompts) → ChatGPT + Gemini scrapes → 1 Claude structured call | per-platform score (60 % mention rate + 40 % citation rate), prompt-level visibility, competitors, *paid*: recommendations |

Supporting features include email and password auth, Stripe subscriptions (Pro and Plus, monthly
or annual), per-plan usage limits, report history with live progress, and a marketing landing page.

**Stack:** Next.js 16.2 App Router · React 19.2 · TypeScript (strict) · Prisma 6.19 on MongoDB ·
Better Auth 1.6 + Stripe plugin · Trigger.dev 4.5.9 · Vercel AI SDK 7 via AI Gateway
(`anthropic/claude-sonnet-4.6`) · Bright Data Datasets API · TanStack Query 5 · RHF + Zod 4 ·
shadcn/ui on Base UI 1.6 · Tailwind 4 · GSAP.

## 2. Architecture at a glance

```
           ┌───────────── Next.js (one deployable) ─────────────┐
 Browser ─▶│ RSC layouts (session gate) · client pages          │──── Prisma ───▶ MongoDB
   ▲       │ thin route handlers: auth → Zod → quota → create   │                   ▲
   │       │ report → tasks.trigger → 202                       │                   │ Prisma
   │       └───────────────────────────┬─────────────────────────┘                   │
   │                                   │ tasks.trigger                                │
   │ realtime metadata                 ▼                                              │
   └──────────────────────── Trigger.dev tasks ──────────────────────────────────────┘
                              │ dataset trigger(endpoint = waitpoint URL) │ generateText + Output.object
                              ▼                                           ▼
                        Bright Data ──webhook──▶ waitpoint          AI Gateway → Claude
```

**Style:** a modular monolith plus an external durable-workflow engine. There are three tiers:
client-rendered UI, thin route controllers that call `lib/*` and Prisma directly (no service or
repository layer), and workers that own every third-party call. Full detail is in the
[codemaps](CODEMAPS/architecture.md). The report status lifecycle as actually implemented,
including its non-terminating paths, is in [workers](CODEMAPS/workers.md#report-status-lifecycle-as-implemented).

## 3. What is done well (keep these)

1. **Thin, uniform routes.** Every mutating route runs the same sequence: authenticate, validate
   with Zod, check quota, create the report, trigger the task, return 202.
2. **Durable orchestration without polling.** Each Bright Data job gets a waitpoint token's
   callback URL as its webhook. The run checkpoints while it waits, and checkpointed waits cost
   no compute (`maxDuration` counts compute seconds only). Nothing holds an HTTP request open.
3. **Idempotency.** The task persists snapshot IDs *before* waiting and gives each token a
   per-report idempotency key (`isCached` on re-create). A retry after an LLM failure therefore
   reuses the paid scrape. Each task re-validates its payload against the stored row, and
   `markJobFailed` cannot overwrite `COMPLETED`.
4. **The LLM structures evidence; code does the math.** Output is a Zod-validated structured
   object, and a schema mismatch or refusal throws instead of defaulting. Domain counts, shares,
   source mix, platform scores and labels are recomputed in code, which overrides the model's
   arithmetic.
5. **Defense in depth on reads.** Report queries are owner-scoped (`findFirst({ id, userId })`),
   report IDs must match the ObjectId pattern, realtime tokens are read-scoped to a single run,
   responses send `Cache-Control: private, no-store`, nothing uses `dangerouslySetInnerHTML`,
   and `website` is never fetched server-side (no SSRF).
6. **One source of truth for usage.** Usage is derived from `Report` rows, not drifting
   counters, and plan limits live in one file.
7. **Shared client/server schemas** for the visibility and auth forms, and the auth forms are
   accessible (labels, `role=alert`).
8. **Partly clean baseline.** `tsc --noEmit` and `prisma validate` pass, source ESLint reports
   0 errors, and the react-hooks lint rules are on. `next build` still fails (finding 1), which
   shows why type and lint gates alone aren't enough.

## 4. Findings

Severity follows ECC's CRITICAL/HIGH/MEDIUM/LOW scale. Every row was traced in code. Every row a
specialist agent contributed was re-verified by the orchestrator against the code, installed
dependency sources, or a real build. One agent premise was corrected: trigger-time realtime
tokens default to **1h**, not 15 min. *Inferred* marks behaviour of third-party services that
couldn't be exercised offline.

| # | Sev | Area | Finding | Evidence | Fix | Found by |
|---|-----|------|---------|----------|-----|----------|
| 1 | CRITICAL | Build | `next build` fails: *"You're importing a module that depends on `usePathname`… into a React Server Component"*. `SiteHeader` has no `"use client"` but uses `usePathname`, `useRef` and `useGSAP`, and Server Components render it. `/pricing` and `/auth/*` also error in dev | `components/site-header.tsx:1-16`; `app/(routes)/(landingpage)/pricing/page.tsx:3`; `app/(routes)/(landingpage)/auth/layout.tsx:2`; build log | Add `"use client"`, or better, split the GSAP animation into a client island so `/auth` and `/pricing` don't ship GSAP | react-reviewer; **confirmed by running `next build`** |
| 2 | HIGH | Billing / security | Paid insights reach free users. The API returns the full `result`, tasks return the full report as run output, and the client reads `output.report`. `FeatureLock` only skips rendering | `app/api/reports/[id]/route.ts:95-100`; `trigger/keyword-research.ts:295-301`; `trigger/search-visibility.ts:249-254`; `components/reports/live-report-progress.tsx:57-60`; `components/feature-lock.tsx:26` | Redact paid fields server-side from entitlements. Have tasks return `{jobId}` only. Optionally skip generating paid sections for free plans | security-reviewer, react-reviewer, orchestrator |
| 3 | HIGH | Dependencies | `next@16.2.12` is inside critical/high advisory ranges: Image Optimization RCE with AVIF (GHSA-2xp9-vwfh-vxw4), Image Optimization SSRF (GHSA-cjq9-62q9-8jv4), Windows RCE, `next/og` RCE. The optimizer is enabled and serves about 250 flag images | `package.json`; `next.config.ts`; `components/ai-keyword/keyword-search-row.tsx:66-76`; `npm audit` | Upgrade to `next@16.4.0` (non-major) and re-run the audit | quality gate |
| 4 | HIGH | Abuse / cost | A script can sign up repeatedly and spend for free. There is no email verification, sign-up logs the user straight in, and free quota is per account. The spending POST routes have no rate limit, and the tasks have no queue concurrency limit | `lib/auth.ts:18-22`; `components/auth/sign-up-form.tsx:35-46`; `lib/plans.ts:2-5` | Require verification before scans; CAPTCHA on sign-up; per-user and per-IP limits in a shared store; `queue.concurrencyLimit` and per-user `concurrencyKey`; spend alerts | security-reviewer |
| 5 | HIGH | Billing | Quota is checked by counting rows, then the report is created. Parallel POSTs all read the same count and all pass. A Mongo transaction alone doesn't fix this: inserting different documents doesn't conflict (write skew) | `lib/billing.ts:35-50`; `app/api/keyword-research/route.ts:43→54`; `app/api/search-visibility/route.ts:32→43` | Atomic reservation: per-user, per-period usage doc, `$inc` guarded by `$lt: limit`; or a lock document inside the transaction | security-reviewer, database-reviewer, orchestrator |
| 6 | HIGH | Pipeline integrity | Bright Data error rows are scored as evidence. Both tasks request `include_errors`, `force_deliver` and the `error` fields, then only check for a non-empty array. If Gemini blocks all 5 prompts, the report is saved `COMPLETED` as "Hidden" with Gemini at 0 % under "5 prompts checked". Partial failures still divide by 5. A keyword run whose only row is an error still gets a score and competitors | `trigger/keyword-research.ts:130-133,244,345`; `trigger/search-visibility.ts:198-205,340,446-456` | Zod-validate deliveries; count and drop error rows; fail or mark partial below a threshold; use answered rows as denominators | silent-failure-hunter, orchestrator |
| 7 | HIGH | Pipeline integrity | Visibility retries regenerate the 5 prompts but reuse the persisted snapshots and cached tokens, so attempt 2 analyses answers to prompt set A as if they answered set B. The prompt says "preserve the submitted prompt text exactly". A failure between the two triggers leaves ChatGPT and Gemini asked different questions. The report is still saved `COMPLETED` | `trigger/search-visibility.ts:134,136-147,155-182,422,460` | Persist the prompts with the snapshot IDs and reuse them on retry | orchestrator, silent-failure-hunter, database-reviewer |
| 8 | HIGH | Frontend | The mobile dashboard menu crashes when opened. `DropdownMenuLabel` (Base UI `Menu.GroupLabel`) sits outside `Menu.Group`, and Base UI throws *"MenuGroupContext is missing"*. With no `error.tsx` anywhere, the page dies, and this menu is the only navigation below `lg` | `components/dashboard-navbar.tsx:145`; `@base-ui/react/menu/group/MenuGroupContext.mjs:7-12` | Wrap the label in `DropdownMenuGroup`; use menu link items; add `app/error.tsx` and segment error boundaries | react-reviewer; confirmed in Base UI source |
| 9 | HIGH | Quality | No automated tests or test runner (`testsprite/` has plans only). ECC requires 80 % coverage | repo-wide | Unit tests for `buildSourceMetrics`, `extractResearchSourceUrls`, score math and quota logic; route tests (auth, ownership, quota race); `next build` in CI; Playwright E2E with stubbed task output | ECC rules |
| 10 | MEDIUM | Billing | Failed and orphaned reports consume quota. Usage counts every status, and the row exists before the trigger. Free usage is lifetime, so an outage plus the UI's "Retry report" (a new row each time) can use up a free account with zero results. `past_due` subscribers drop to free (lifetime count), which returns 403 | `lib/billing.ts:18-20,33-50`; `app/api/keyword-research/route.ts:54,117-129`; `app/(routes)/(dashboard)/ai-keyword/page.tsx:141-150` | Exclude or refund failures before collection; decide a `past_due` grace policy | security-reviewer, silent-failure-hunter, database-reviewer |
| 11 | MEDIUM | Pipeline state | Start-path and replay inconsistencies. (a) If saving `triggerRunId` throws after a successful trigger, the route marks `FAILED`, but unguarded progress writes flip it to `COLLECTING` then `COMPLETED`. (b) A crash between create and trigger leaves `PENDING` with no run ID, never reconciled, polled every 3s forever. (c) Replaying a completed run more than 24h later flips `COMPLETED` → `FAILED`. (d) There's no idempotency key on `tasks.trigger`, while the SDK retries API calls up to 5×, so duplicate paid runs are possible (*inferred*) | `app/api/keyword-research/route.ts:73-95,117-129`; `trigger/keyword-research.ts:647-658,676`; `lib/reports.ts:34`; `@trigger.dev/core` `DEFAULT_ZOD_FETCH_OPTIONS` | `tasks.trigger(..., { idempotencyKey: report.id })`; progress writes as `updateMany` limited to non-terminal statuses; early-return on terminal reports; age-based reconciliation of run-less rows | silent-failure-hunter, database-reviewer |
| 12 | MEDIUM | Pipeline state | `onFailure` fires only when the run function throws its last error, and per Trigger.dev docs `onCancel` doesn't fire while a run is suspended on a token. Both tasks spend most of their life in `wait.forToken`, so cancel, `maxDuration` or a crash leaves the report `COLLECTING` (and the Bright Data job running) until someone opens `/reports`, which triggers read-time repair | `trigger/keyword-research.ts:240,303-316`; `trigger/search-visibility.ts:191-196,256-269`; SDK JSDoc for `onFailure` | Reconcile from a scheduled task or Trigger.dev alerts, not on read; cancel Bright Data jobs on cancel | silent-failure-hunter (onCancel: *inferred from docs*) |
| 13 | MEDIUM | Frontend realtime | Live progress is fragile. Any subscription error shows the visibility *failure* card even if the scan later succeeds, which invites a quota-spending re-run, while keyword search stays disabled until reload. After a failed scan, retry reuses the same `LiveVisibilityProgress` (no `key`), and `useRealtimeRun`'s `hasCalledOnCompleteRef` never resets, so the new results never render | `components/ai-search-visibility/live-visibility-progress.tsx:84-87`; `app/(routes)/(dashboard)/ai-search-visibility/page.tsx:116`; `app/(routes)/(dashboard)/ai-keyword/page.tsx:110-112`; `@trigger.dev/react-hooks` `useRealtime.js:62-69` | `key={runId}`; treat subscription errors as "reconnecting" and fall back to polling plus a re-minted token | react-reviewer, silent-failure-hunter |
| 14 | MEDIUM | Performance | `/reports` and `/reports/[id]` poll every 3s while anything is processing, and the detail page polls on top of realtime. Each list poll calls `runs.retrieve` for every processing row (up to 100), and each detail poll mints a new token. A report POST costs about 9 DB round trips | `app/(routes)/(dashboard)/reports/page.tsx:31`; `…/reports/[id]/page.tsx:48`; `app/api/reports/route.ts:48-50`; `lib/reports.ts:37` | Reconcile off the request path; poll only without realtime; cache entitlements per request | orchestrator, react-reviewer, database-reviewer |
| 15 | MEDIUM | Data integrity | `result` JSON is read with an unchecked `as` cast into hand-written types that are looser than the Zod types the tasks write (e.g. `strength: string`, optional `scoreLabel`). No `schemaVersion` is stored, so a schema change silently breaks old reports | `app/api/reports/[id]/route.ts:95-100`; `lib/keyword-report.ts:3-48`; `types/search-visibility.ts:12-42` | Move schemas to `lib/`, infer types from them, `safeParse` on read, store a version | database-reviewer, orchestrator |
| 16 | MEDIUM | Frontend / privacy | Sign-out doesn't clear the app-wide React Query cache. The next user in the same tab briefly sees the previous user's billing and reports, within `staleTime` of 10–30s. New reports don't invalidate `["reports"]`. The dashboard layout's auth check doesn't re-run on client navigation | `components/dashboard-navbar.tsx:52-62`; `components/query-provider.tsx:12-13`; `app/(routes)/(dashboard)/layout.tsx:12-18` | `queryClient.clear()` on sign-out; invalidate after create; handle 401 with a redirect | react-reviewer |
| 17 | LOW | Security / ops | Raw internal errors are shown to users, e.g. "BRIGHT_DATA_API_TOKEN is not configured", "…failed with status 401". Reconciliation failures log at `warn` without the run ID and repeat on every poll | `trigger/keyword-research.ts:303-308,322`; `lib/reports.ts:58-61,90`; `components/reports/report-failed.tsx:40` | Map to user-safe messages; structured logs with report, run and snapshot IDs | security-reviewer, silent-failure-hunter, database-reviewer |
| 18 | LOW | Pipeline | A 15-minute token timeout fails the attempt. Retries get the same cached, timed-out token and fail instantly, so a late Bright Data delivery is lost after being paid for. If Bright Data accepts a request but the 30s abort fires first, the retry starts a second paid collection | `trigger/*.ts` `createToken` and `AbortSignal.timeout(30_000)` | Fetch the snapshot by ID on timeout; persist the snapshot before abort-sensitive steps | orchestrator, silent-failure-hunter, database-reviewer |
| 19 | LOW | Config hygiene | No security headers (CSP, `frame-ancestors`). `.gitignore` covers only `.env`. Env is unvalidated (`!`). `.env.example` exposes the author's Atlas host | `next.config.ts`; `.gitignore:36`; `lib/auth.ts:9-46`; `.env.example:1` | Add headers; ignore `.env*`; validate env with Zod at boot | security-reviewer |
| 20 | LOW | Tooling | `npm run lint` fails (497 errors, all in the un-ignored `generated/prisma`). The `shadcn` CLI is a runtime dependency that pulls express, hono and the MCP SDK into prod installs. `@better-auth/prisma-adapter` is a phantom dependency. The app resolves Prisma 6.19.3 while the Trigger build pins 6.19.0. Turbopack warns that the whole project is traced into functions | `eslint.config.mjs`; `package.json`; `trigger.config.ts:27`; build log | Ignore `generated/**`; move `shadcn` to devDependencies; declare the adapter; pin identical exact Prisma versions | quality gate, database-reviewer |
| 21 | LOW | Billing | `getBillingStatus(userId)` ignores `userId` and looks up the *requesting* session's subscriptions. Paid quota resets on the UTC calendar month, not the Stripe period. A failed billing fetch locks paid users out of paid sections | `lib/billing.ts:14-33`; `components/reports/keyword-report-view.tsx:19`; `components/ai-search-visibility/visibility-results.tsx:69` | Query by `referenceId`; count from `periodStart`; treat billing errors as unknown, not free | orchestrator, security-reviewer, silent-failure-hunter |
| 22 | LOW | UI truthfulness | The task writes "Analyzing…" but the step list expects "Analysing…", so steps reset at 50 %. Retries move progress backwards. "Plenty"/success and "Moderate" are hard-coded even at 0, and "Low" opportunities render green, against the repo's own "zero must not look positive" rule. The language picker is dropped, so history shows "English · JP". History is capped at 100 with no pagination | `trigger/keyword-research.ts:257`; `components/reports/live-report-progress.tsx:26,101-104`; `components/ai-keyword/keyword-report-summary.tsx:123-137`; `components/ai-keyword/keyword-search-row.tsx:99,134-144`; `app/api/reports/route.ts:28,65` | Shared step constants; monotonic progress; values drive signals; send or remove `language`; cursor pagination | silent-failure-hunter, react-reviewer, database-reviewer |
| 23 | LOW | Data model | No index serves the usage counts, so paid-plan counts fetch whole documents to check `createdAt`, while `[triggerRunId]` is never queried. User IDs are stored as ObjectId in `user`/`report`/`subscription` but as strings in `session`/`account`, so `$lookup` joins silently match nothing (fixing this needs a data migration) | `prisma/schema.prisma` | Replace `[userId,type,status]` with `[userId,type,createdAt]`; drop `[triggerRunId]`; plan the ObjectId migration | database-reviewer, orchestrator |
| 24 | LOW | Cost / accuracy | The keyword prompt carries `answer_text` and `answer_text_markdown` (the same text twice). Visibility mention and citation counts are LLM-judged though checkable in code. ChatGPT is collected with `web_search:false`, so its citation score is structurally near zero (*inferred*) | `trigger/keyword-research.ts:122-134,439`; `trigger/search-visibility.ts:353-355,438-458` | Trim inputs; count in code; decide on web search deliberately | orchestrator |
| 25 | LOW | Frontend structure | Near-duplicate live-progress components (~80 % shared, behaving differently); a 10-branch ternary in `/reports/[id]`; 6–7 `useState`s per product page; `useMutation` on one page and raw `fetch` on the other. Every dashboard page and the 647-line landing page are client components. Dead code: `lib/keyword-demo-report.ts`, `logout-button.tsx`, `mode-toggle.tsx`, the `hello-world` task, an inert "Send feedback" button. `aria-live` on a rotating headline word | `components/reports/live-report-progress.tsx`; `components/ai-search-visibility/live-visibility-progress.tsx`; `app/(routes)/(dashboard)/reports/[id]/page.tsx:117-165`; `components/ai-search-visibility/visibility-search-form.tsx:79` | One `useReportRun()` hook + `RunProgress({steps})`; RSC pages with client islands; delete dead code | react-reviewer, orchestrator |

## 5. Key design decisions and trade-offs (ADR-style)

### ADR-1: Durable jobs on Trigger.dev with webhook waitpoints
- **Context:** A scrape takes minutes, which exceeds serverless request limits, and both products need live progress.
- **Decision (as built):** Each product has one `schemaTask`. Bright Data delivers to a waitpoint callback URL, and progress flows through run metadata to the realtime hooks.
- **Pros:** no queue, cron or worker infrastructure to run. Retries, checkpointing, logs and realtime come built in.
- **Cons:** three SaaS vendors sit in the critical path (Trigger.dev, Bright Data, AI Gateway). The app is two deployables with separate env sets. Run output duplicates report data inside Trigger.dev. Lifecycle hooks don't cover suspended or killed runs (finding 12). Local development needs `trigger dev`.
- **Alternatives:** Inngest or Upstash Workflow; a BullMQ + Redis worker; polling Bright Data's snapshot API from cron.
- **Assessment:** right for this size. Keep it. Persist every non-deterministic input (generated prompts) before external calls, guard every state write, stop returning the report as run output, and run reconciliation on a schedule.

### ADR-2: MongoDB, one polymorphic `Report`, JSON `result`
- **Pros:** flexible result shape, one collection for history, simple queries.
- **Cons:** each report type leaves the other type's input columns null, and nothing ties `type` to its columns. `result` is cast on read, not validated. Prisma on Mongo has no migrations (indexes come from `db push`), and foreign keys are emulated, so deletes made outside Prisma leave orphans.
- **Alternatives:** Postgres with typed per-product tables and a JSONB result; or keep Mongo and add a discriminated union with `schemaVersion`, parsed by Zod on read.
- **Assessment:** acceptable. Add `schemaVersion` and parse on read. Revisit Postgres if cross-report analytics or joins grow.

### ADR-3: Usage derived from `Report` rows
- **Pros:** no counter drift; easy to audit.
- **Cons:** the check counts first and creates second, so concurrent requests race, and transactions alone don't help (write skew). Failed or never-started reports consume quota. Every check makes two count queries plus a subscription lookup. Paid plans reset on the UTC calendar month, not the billing period.
- **Alternative:** an atomic per-user, per-period usage document. Reserve with `$inc` guarded by `$lt: limit`, and refund when a run fails before collection.
- **Assessment:** move to atomic reservation with an explicit refund policy.

### ADR-4: LLM as evidence transformer, metrics in code
- **Pros:** answers stay grounded and cost one call per stage. No agentic browsing is needed, and output is schema-validated.
- **Cons:** visibility mention and citation counts are still the model's judgment, even though a deterministic match is feasible (brand string in `answer_text`, hostname in `citations`). The whole raw delivery is passed to the model, including error rows and duplicate `answer_text` / `answer_text_markdown`. Scraped third-party text enters the prompt; impact is limited to report accuracy, since the model has no tools and its output is schema-bound and escaped.
- **Assessment:** compute mentions and citations in code, pre-filter and trim records, and treat scraped text as untrusted data in the prompt.

### ADR-5: Better Auth with its Stripe plugin
- **Pros:** almost no custom auth or billing code. Sessions live in the DB, and the plugin handles the subscription lifecycle through webhooks (signature-checked with `STRIPE_WEBHOOK_SECRET`).
- **Cons:** email verification is off. No cookie cache is configured, so every session check hits the DB, including landing-page hits through `proxy.ts`. `getBillingStatus(userId)` reads subscriptions from the *request headers*, not from `userId`, so it cannot run from workers or cron. Plan names drift between the code (`plus`) and the docs (`business`).
- **Assessment:** keep it. Enable email verification and the cookie cache, and query subscriptions by `userId`.

### ADR-6: Client-rendered dashboard (React Query + realtime)
- **Context:** the dashboard needs live progress and a report history.
- **Decision (as built):** every dashboard page is a client component that fetches route handlers through React Query. Server layouts gate auth, and Trigger.dev hooks stream progress.
- **Pros:** a simple mental model. Live progress is cheap, and the result components are reused for live and saved reports.
- **Cons:** every page ships as client JS and fetches after hydration. Entitlement decisions happen in the browser. Layout auth checks don't re-run on client navigation. Two progress channels run at once (realtime and 3s polling). One query cache is shared across users in a tab. There are no error boundaries.
- **Alternative:** RSC pages that load through `lib/` functions and pass *redacted* data to client islands, with only progress on the client; `error.tsx` per segment.
- **Assessment:** fine for an MVP. Move entitlements server-side and add error boundaries first, then convert the history and detail pages to RSC with client islands.

## 6. ECC conformance

### Architect red-flag checklist (`agents/architect.md`)
| Red flag | Present? | Notes |
|----------|----------|-------|
| Big Ball of Mud | No | clear tiers and one pattern per product |
| Golden Hammer | Mild | the LLM still counts mentions and citations that code could count |
| Premature Optimization | No | |
| Not Invented Here | No | managed auth, billing, jobs and scraping |
| Analysis Paralysis | No | |
| Magic | Yes | `AGENTS.md` drifts from the code ([§8](#8-spec-drift-agentsmd-vs-code)); env requirements are implicit; step labels are copied as string literals across the route, task and UI |
| Tight Coupling | Some | routes call Prisma directly; result types are hand-written twins of the Zod schemas; route, task and progress UI are duplicated per product |
| God Object | No | |

### ECC rules (`rules/common`, `rules/typescript`, `rules/web`)
| Rule | Status | Evidence |
|------|--------|----------|
| Build and verify before shipping | No | `next build` fails (finding 1) |
| Validate input at boundaries | Mostly | Zod on every POST body, task payload and LLM output. Not on Bright Data deliveries or on JSON `result` reads |
| AuthN/AuthZ verified | Yes | session check in every route; every report query includes `userId` |
| No hardcoded secrets | Yes | only non-secret IDs are hardcoded (dataset IDs, Trigger project ref) |
| Validate secrets at startup | No | `process.env.X!` assertions in `lib/auth.ts:9-46` |
| Rate limiting on all endpoints | No | only Better Auth's built-in limiter on `/api/auth/*` |
| Error messages don't leak | No | raw `error.message` is shown to users (finding 17) |
| Error handling, no silent failures | No | error rows scored as evidence; unguarded state writes; swallowed subscription errors (findings 6, 11, 13) |
| Functions < 50 lines | No | 41 functions exceed it, e.g. task `run` bodies (163 and 173 lines), POST handlers (116 and 104), `KeywordReportSummary` (287) |
| Files < 800 lines | Yes | the largest is `trigger/keyword-research.ts` at 692 |
| Immutability | Mostly | mutation is limited to local accumulators, which is idiomatic |
| 80 % coverage, TDD | No | no tests |
| React hooks lint rules | Yes | `eslint-config-next` core-web-vitals includes `react-hooks` |
| API response envelope | No | ad hoc `{ message }` and per-route DTOs |
| Repository pattern | No | acceptable at this size; worth adding when the report service is extracted |

## 7. Recommended target architecture and roadmap

```
app/api/<product>/route.ts ──▶ features/<product>/service.ts
                                 ├─ entitlements.forUser(userId)   plan · limits · paid flags (by userId, not headers)
                                 ├─ usage.reserve(userId, feature) atomic $inc ≤ limit, refund on early failure
                                 ├─ reports.create / trigger(idempotencyKey = reportId) / read(redact by entitlement)
                                 └─ schema.ts                      Zod input + versioned result → types for task and UI
trigger/<product>.ts ──▶ features/<product>/pipeline.ts (pure steps, unit-tested)
                          plan prompts → persist → collect → validate delivery → analyze (LLM) → compute (code)
                          → guarded write (status ∉ {COMPLETED, FAILED}) → return {jobId}
trigger/reconcile.ts (scheduled) ──▶ repair stale / run-less reports; cancel orphaned Bright Data jobs
```

**P0, before anyone pays for it**
1. Make it build: `"use client"` on `SiteHeader` (or an animation island); fix the mobile menu group; add `app/error.tsx`; add `next build` to CI.
2. Upgrade to `next@16.4.0`; move `shadcn` to devDependencies; re-run `npm audit`.
3. Server-side entitlements: redact paid fields in `/api/reports/[id]`; tasks return `{jobId}` only.
4. Spend controls: email verification before scans, CAPTCHA, per-user and per-IP rate limits, atomic quota reservation, Trigger.dev concurrency limits, spend alerts.
5. Pipeline correctness: drop and count Bright Data error rows; persist visibility prompts; idempotency key on `tasks.trigger`; guarded progress writes.

**P1, first month**
6. Tests (ECC `tdd-guide` / `e2e-runner`): pure metric and score functions, quota and ownership route tests, and Playwright flows with stubbed task output.
7. A scheduled reconciler instead of read-time repair; stop polling while realtime is live; resilient realtime (`key={runId}`, reconnect fallback).
8. User-safe error messages and structured logs (report, run and snapshot IDs); Sentry and Trigger.dev alerts.
9. Env validation at boot, security headers, `.env*` ignored, `queryClient.clear()` on sign-out.
10. Versioned result schemas shared by tasks and UI, parsed on read.

**P2, as it grows**
11. Extract `features/<product>/` modules and a report service to remove per-product duplication; one shared progress component.
12. Deterministic mention and citation counting; trimmed LLM inputs (cost).
13. RSC history and detail pages with client islands; landing page as RSC with animation islands.
14. Billing by Stripe period, a `past_due` grace policy, the Better Auth cookie cache, and fixed indexes.
15. Fix `AGENTS.md` drift and delete the second copy (`AGENTS-only.md`).

## 8. Spec drift (`AGENTS.md` vs code)

| Spec says | Code does |
|-----------|-----------|
| `lib/prompt.ts`, `lib/keyword-score.ts` own prompts and score labels | neither exists. Prompts are inline in the tasks; labels live in `lib/keyword-report.ts:50-61` |
| "Keep the currently unmounted `components/dashboard-sidebar.tsx`" | the file doesn't exist |
| Plan "Plus" with `STRIPE_PLUS_*` (`AGENTS.md`) | `AGENTS-only.md` says "Business" with `STRIPE_BUSINESS_*`. The code uses `plus`, so the repo carries two diverging specs |
| Routes `/reports/[reportId]`, `/api/reports/[reportId]` | `[id]` |
| AI summary insights, content opportunities and "How to improve" are paid | paid in the UI only (finding 2) |
| "The server is authoritative" on usage | it is, but not atomic (finding 5) |
| "Every report query must include the signed-in user's ID" | reconciliation and task updates filter by `id` only. Safe in context, since those IDs come from owner-checked reads |
| "Forms use React Hook Form with Zod" | the keyword form uses `useState` + `FormData` with an inline route schema, and drops `language` |
| "Status colors must be truthful: zero must not look positive" | hard-coded "Plenty"/success; green "Low" (finding 22) |
| "Mark reports failed in `onFailure` and `onCancel`" | implemented, but the hooks don't fire for suspended or killed runs (finding 12) |
| "Save and reuse Bright Data snapshot IDs across retries" | done, but generated prompts aren't saved (finding 7) |
| Environment list | omits `TRIGGER_SECRET_KEY`; `.env.example` lists 3 vars and points to a paid license for the rest |

## 9. Scalability plan

The binding constraints are third-party cost and quotas (Bright Data concurrency, Claude tokens,
Trigger.dev concurrency), not compute.

| Scale | What breaks first | Change |
|-------|-------------------|--------|
| Up to ~1K users | Spend abuse (finding 4) and quota races, not load | P0 spend controls; task concurrency limits |
| ~10K users | 3s polling × `runs.retrieve` per processing row; about 9 DB round trips per report POST; counts with no matching index | scheduled reconciliation; poll only without realtime; per-request entitlement cache; `[userId,type,createdAt]` index |
| ~100K users | Report documents carry results inline, Trigger.dev keeps a second copy as run output, and history is capped at 100 rows | results in their own collection or object storage; usage ledger; cursor pagination; per-user `concurrencyKey` |
| 1M+ users | Single-region Mongo and single-vendor scraping | read replicas or sharding by `userId`; a provider abstraction over Bright Data; shared scrapes for popular keywords |

## 10. Keep using ECC on this codebase

ECC installs as a Claude Code plugin with `/plugin marketplace add https://github.com/affaan-m/ECC`
and then `/plugin install ecc@ecc`. Plugins cannot ship rules, so copy `rules/common` plus
`rules/typescript` and `rules/web` into `~/.claude/rules/ecc/`. Map this codebase's work onto
ECC like this:

| When you… | ECC agent / skill |
|-----------|-------------------|
| change `trigger/*` or LLM prompts | `silent-failure-hunter`, `cost-aware-llm-pipeline` skill |
| change `app/api/*`, auth or billing | `security-reviewer`, `security-review` + `api-design` skills |
| change `prisma/schema.prisma` or queries | `database-reviewer`, `prisma-patterns` skill (translate to Mongo semantics) |
| change `components/*` or pages | `react-reviewer`, `react-patterns` + `frontend-patterns` skills; `react-build-resolver` when the build breaks |
| add tests (start here) | `tdd-guide`, `e2e-runner`, `react-testing` skill |
| restructure | `architect` / `code-architect`, then `/update-codemaps` to refresh these maps |

---

## Appendix: how the ECC harness was applied

| Step | ECC piece | What ran |
|------|-----------|----------|
| Reconnaissance and mapping | `skills/codebase-onboarding` (phases 1–3) | manifests, configs, entry points, conventions. The repo's `CLAUDE.md` → `AGENTS.md` served as the existing spec |
| Synthesis | `agents/architect.md` (current state, trade-offs, red flags, ADRs, scalability) | done by the orchestrating session after reading the whole backend |
| Specialist review (parallel) | `agents/security-reviewer.md` + `skills/security-review`; `agents/database-reviewer.md` + `skills/prisma-patterns`; `agents/silent-failure-hunter.md` + `skills/backend-patterns`; `agents/react-reviewer.md` + `skills/react-patterns`, `skills/frontend-patterns` | four read-only subagents loaded these definitions as their operating instructions and reviewed the whole tree. The orchestrator re-verified every finding it kept |
| Quality gates | the gates ECC agents call for (`npm audit`, lint, typecheck, build) | `npm ci --ignore-scripts`, `prisma validate`, `prisma generate`, `tsc --noEmit`, `eslint`, `npm audit --omit=dev`, `next build` (dummy env), on a scratch copy |
| Rule conformance | `rules/common`, `rules/typescript`, `rules/web` | thresholds checked; function lengths measured with the TypeScript compiler API |
| Codemaps | `commands/update-codemaps.md` / `agents/doc-updater.md` | [`CODEMAPS/`](CODEMAPS/architecture.md), each with a freshness header |

Limits: this was a static review of a shallow clone plus a local build. Nothing ran against live
MongoDB, Stripe, Trigger.dev or Bright Data. Behaviour that depends on those services is marked
*inferred*.
