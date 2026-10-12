<!-- Generated: 2026-10-12 | Source: TechWithEmmaYT/AI-SEO-Marketing-SaaS-App@de4843f | Files scanned: 161 | Token estimate: ~1150 -->
# RankSEO — System Architecture

**Shape:** one Next.js 16 App Router deployable (UI + thin API routes) plus a Trigger.dev v4
worker project in the same repo, sharing one Prisma client and MongoDB. Not a monorepo, no
separate API service, no queue or cache of its own: Trigger.dev is the async backbone.

## Topology

```
Browser (React 19 · React Query · @trigger.dev/react-hooks)
  │ HTTPS + Better Auth session cookie              ▲ realtime run metadata
  ▼                                                 │ {status, progress, currentStep} (run-scoped token)
Next.js 16 app ─────────────────────────────────────┼───────────────────────────────┐
│ proxy.ts             "/" + "/auth/*": signed-in → 302 /ai-keyword                │
│ (dashboard)/layout   RSC getSession() → redirect /auth/sign-in                   │
│ /api/auth/[...all]   Better Auth email+password + Stripe plugin ◀── Stripe webhook│
│ POST /api/keyword-research · /api/search-visibility → 202 {jobId, runId, token}  │
│ GET  /api/reports · /api/reports/[id] · /api/billing/status                      │
└───────┬───────────────────────────────────────────────┬──────────────────────────┘
        │ Prisma 6.19 (classic engine)                  │ tasks.trigger · runs.retrieve · auth.createPublicToken
        ▼                                               ▼
   MongoDB ◀────────────── Prisma ───────────── Trigger.dev v4 workers (trigger/)
   user · session · account ·                    keyword-research   1 scrape → 1 LLM call
   verification · subscription · report          search-visibility  1 LLM → 2 scrapes → 1 LLM
                                                   │ dataset trigger (endpoint = waitpoint URL)
                                                   ├─▶ Bright Data Datasets API ─webhook─▶ waitpoint → run resumes
                                                   └─▶ Vercel AI Gateway → anthropic/claude-sonnet-4.6
```

## Tiers and ownership

| Tier | Owns | Never does |
|------|------|------------|
| Next.js routes | authn, Zod validation, quota check, `Report` create, task trigger, owner-scoped reads | call Bright Data or the LLM |
| Trigger.dev tasks | scraping, LLM calls, metric math, progress writes, terminal status | see the user's plan (paywall unaware) |
| MongoDB | users, sessions, subscriptions, reports + JSON results | enforce FKs (Prisma emulates relations) |
| Browser | forms, live progress, rendering, paid-section locking (`FeatureLock`) | anything authoritative |

## Report lifecycle (both products)

```
POST /api/<product> ─▶ session ─▶ Zod ─▶ checkUsageLimit ─▶ Report.create(PENDING, 5%)
  ─▶ tasks.trigger(<task>, {jobId,…}, tags[report:<id>, user:<id>]) ─▶ Report.update(triggerRunId)
  ─▶ 202 {jobId, runId, publicAccessToken}
Task: COLLECTING 20% ─▶ wait.createToken(idempotencyKey=<task>-<id>, 15m) ─▶ Bright Data trigger
  ─▶ persist snapshot id ─▶ wait.forToken (checkpointed) ─▶ ANALYZING ─▶ generateText+Output.object
  ─▶ code-computed metrics ─▶ Report.update(COMPLETED, 100%, result) + metadata.flush
Failure: onFailure/onCancel ─▶ updateMany(status≠COMPLETED → FAILED)
Read-time repair: lib/reports.ts reconcileTerminalReport ─▶ runs.retrieve ─▶ FAILED if run died
```

## Cross-cutting

- **Auth:** Better Auth cookie sessions; DB lookup per request (no cookie cache). Each API route
  re-checks the session; `proxy.ts` only redirects signed-in users *away* from public pages.
- **Authorization:** every report query includes `userId`; realtime tokens are read-scoped to one run.
- **Billing:** plan = active/trialing subscription from the Better Auth Stripe plugin; limits in
  `lib/plans.ts`; usage = `count(Report)` per type (free: lifetime, paid: UTC calendar month).
- **Paywall:** UI-only. APIs and run output return the full result to every plan.
- **Config:** secrets from env; model id, Bright Data dataset ids and Trigger project ref are
  hardcoded by design (see repo `AGENTS.md`).
- **Tests:** none (TestSprite plan JSON only). **Observability:** `console.*` + Trigger.dev logger.
- **Build status at `de4843f`:** `tsc` and `prisma validate` pass; **`next build` fails**
  (`components/site-header.tsx` lacks `"use client"`). See the [review](../ARCHITECTURE-REVIEW.md).

## Related codemaps
[backend](backend.md) · [workers](workers.md) · [frontend](frontend.md) · [data](data.md) · [dependencies](dependencies.md)
