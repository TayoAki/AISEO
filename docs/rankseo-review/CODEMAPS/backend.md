<!-- Generated: 2026-10-12 | Source: TechWithEmmaYT/AI-SEO-Marketing-SaaS-App@de4843f | Files scanned: 21 | Token estimate: ~950 -->
# RankSEO — Backend (Next.js routes + server libs)

No service or repository layer: route handlers call `lib/*` helpers and Prisma directly.
Every handler is a plain `route.ts` (no server actions).

## Routes
```
GET|POST /api/auth/[...all]   → toNextJsHandler(auth)          Better Auth + Stripe plugin endpoints/webhook
GET  /api/billing/status      → getCurrentBillingStatus()      listActiveSubscriptions + 2× report.count
POST /api/keyword-research    → getSession → Zod{keyword 2–120, country /^[A-Z]{2}$/}
                                → checkUsageLimit("keywordSearches") → report.create(KEYWORD, PENDING)
                                → tasks.trigger("keyword-research") → report.update(triggerRunId) → 202
POST /api/search-visibility   → getSession → visibilitySearchSchema{website http(s), brand, topic}
                                → checkUsageLimit("visibilityScans") → report.create(VISIBILITY) → trigger → 202
GET  /api/reports             → getSession → report.findMany(userId, desc, take 100, no result)
                                → reconcileTerminalReport × N (runs.retrieve per processing row) → list DTO
GET  /api/reports/[id]        → getSession → ObjectId regex → report.findFirst({id, userId})
                                → reconcile → detail DTO (+ createPublicToken(read run, 1h) if processing)
```
Trigger failure after `report.create` → row set `FAILED`, 500 returned (row still counts toward quota).

## Request gate (`proxy.ts`, Next 16 proxy, Node runtime)
`matcher: ["/", "/auth/:path*"]` → `auth.api.getSession` → signed-in ⇒ 302 `/ai-keyword`.
Dashboard protection is in `app/(routes)/(dashboard)/layout.tsx` (RSC redirect), not the proxy.

## Server libraries
| File | Exports | Notes |
|------|---------|-------|
| `lib/auth.ts` | `auth`, `Session` | `better-auth/minimal`, `prismaAdapter(prisma,{provider:"mongodb"})`, email+password (8–128), `generateId:false` (Mongo ObjectIds), Stripe plugin plans `pro`/`plus` (monthly + annual price env ids, `limits` from plans), `nextCookies()` |
| `lib/auth-client.ts` | `authClient`, `signIn/signOut/signUp/useSession` | `stripeClient({subscription:true})` |
| `lib/billing.ts` (server-only) | `getBillingStatus(userId)`, `getCurrentBillingStatus()`, `checkUsageLimit(userId, feature)` | plan from *request headers* session, usage from `Report` counts |
| `lib/plans.ts` | `PLAN_LIMITS`, `BillingPlan`, `UsageFeature` | free 2/2 lifetime · pro 100/25 · plus 500/100 per month |
| `lib/reports.ts` (server-only) | `reconcileTerminalReport(report)` | marks `FAILED` when run is CANCELED/FAILED/CRASHED/SYSTEM_FAILURE/EXPIRED/TIMED_OUT |
| `lib/prisma.ts` | default `PrismaClient` | dev global singleton; client generated to `generated/prisma` |
| `lib/search-visibility-schema.ts` · `lib/auth-schemas.ts` | Zod schemas + inferred types | shared by client forms and routes |
| `lib/keyword-report.ts` | `KeywordReport` type, `getKeywordScoreLabel/Tone` | hand-written twin of the task's Zod schema |
| `lib/keyword-demo-report.ts` | `createKeywordDemoReport(keyword)` | **dead code**: fake-report generator, imported nowhere |

## Conventions
- Errors: `{ message, code?, errors? }` with 400/401/403/404/500; jobs return **202**.
- Quota-exceeded: 403 `{ code: "LIMIT_REACHED" }`. Report reads: `Cache-Control: private, no-store`.
- Not present: rate limiting on product routes (only Better Auth's built-in limiter on `/api/auth/*`),
  response envelope, request ids, env validation at boot.

## Related
[architecture](architecture.md) · [workers](workers.md) · [data](data.md)
