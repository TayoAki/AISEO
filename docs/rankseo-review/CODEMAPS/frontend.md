<!-- Generated: 2026-10-12 | Source: TechWithEmmaYT/AI-SEO-Marketing-SaaS-App@de4843f | Files scanned: 13 pages/layouts + 27 feature components | Token estimate: ~1250 -->
# RankSEO — Frontend (App Router, React 19)

## Page tree (RSC = server component, CC = `"use client"`)
```
app/layout.tsx RSC     fonts · ThemeProvider · QueryProvider(staleTime 10s, no focus refetch) · Toaster
├─ (landingpage)/layout.tsx RSC
│  ├─ /                 page.tsx CC, 647 lines: GSAP + HeroShader (221-line component)
│  ├─ /pricing          page.tsx RSC → SiteHeader ✗ · PricingSection CC
│  └─ auth/layout.tsx RSC (SiteHeader ✗ · SiteFooter)
│     ✗ SiteHeader uses hooks without "use client" → `next build` fails at de4843f
│     ├─ /auth/sign-in  → SignInForm CC   RHF + signInSchema → authClient.signIn.email
│     └─ /auth/sign-up  → SignUpForm CC   RHF + signUpSchema → authClient.signUp.email → /ai-keyword
└─ (dashboard)/layout.tsx RSC   getSession → redirect /auth/sign-in · DashboardNavbar(user)
   │  (mobile menu < lg throws on open: GroupLabel outside Menu.Group; no error.tsx anywhere)
   ├─ /ai-keyword            CC  KeywordSearchRow → useMutation POST → LiveReportProgress → KeywordReportView
   ├─ /ai-search-visibility  CC  VisibilitySearchForm → manual fetch POST → LiveVisibilityProgress → VisibilityResults
   ├─ /reports               CC  useQuery ["reports"] (poll 3s while any processing) → ReportsTable
   ├─ /reports/[id]          CC  useQuery ["reports", id] (poll 3s while processing) → view by type × status
   └─ /billing               RSC getCurrentBillingStatus() → PricingSection + ManageBillingButton
```
`proxy.ts` sends signed-in users from `/` and `/auth/*` to `/ai-keyword`.

## State
| Kind | Mechanism | Keys / source |
|------|-----------|---------------|
| Server data | TanStack Query | `["reports"]`, `["reports", id]`, `["billing-status"]` (staleTime 30s) |
| Job progress | `useRealtimeRun<typeof task>(runId, {accessToken})` | run metadata `{status, progress, currentStep}`; completion reads `run.output.report` |
| Entitlement | `useBilling()` → `premiumLocked = isPaid !== true` | drives `FeatureLock` (UI only) |
| Forms | React Hook Form + zodResolver | `lib/auth-schemas.ts`, `lib/search-visibility-schema.ts` (shared with server) |
| Theme / toasts | next-themes · sonner | — |

## Flow: one keyword report
```
KeywordSearchRow ─submit─▶ useMutation ─POST /api/keyword-research─▶ 202 {jobId, runId, publicAccessToken}
  ─▶ <LiveReportProgress runId accessToken> ─useRealtimeRun─▶ progress bar from metadata
  ─▶ run COMPLETED ─▶ output.report ─▶ onComplete(result) ─▶ <KeywordReportView report>
       ─▶ useBilling ─▶ FeatureLock(locked = !isPaid) around summary insights + content opportunities
History: /reports ─▶ /reports/[id] ─GET (+ realtimeAccessToken while processing)─▶
  completed: KeywordReportView | VisibilityResults · processing: Live*Progress (reconnect) · failed: ReportFailed(errorMessage)
```
On `/reports/[id]` both channels run during processing: realtime pushes, and the query polls
every 3s. Each poll calls `runs.retrieve` server-side.

## Components by feature
| Folder | Components |
|--------|------------|
| `components/ai-keyword/` | keyword-search-row (form + country/flag select), keyword-landing-state, keyword-report-summary (287-line component), keyword-report-landscape, keyword-report-opportunities |
| `components/ai-search-visibility/` | visibility-search-form, visibility-landing-state, live-visibility-progress, visibility-results (268-line component) |
| `components/reports/` | reports-table, reports-table-skeleton, live-report-progress, keyword-report-view, report-failed |
| `components/auth/` · `components/pricing/` | auth-card, sign-in-form, sign-up-form, logout-button · pricing-section |
| shared `components/*.tsx` | dashboard-navbar (usage badges), site-header/footer/logo, feature-lock, mode-toggle, theme-provider, query-provider |
| `components/ui/` | 24 shadcn primitives on Base UI |

## Observations
- Dashboard pages render on the client and fetch through route handlers. Only the layouts and
  `/billing` render on the server. The layout's auth check doesn't re-run on client navigation.
- One app-wide QueryClient is never cleared on sign-out, so the next user in the tab briefly sees
  cached billing and reports. Creating a report doesn't invalidate `["reports"]`.
- Realtime is fragile: subscription errors are terminal (the visibility page shows a false
  failure), and `LiveVisibilityProgress` has no `key`, so a retry never renders results.
- The keyword language picker is collected but never sent; history shows "English".
- `live-report-progress.tsx` and `live-visibility-progress.tsx` are near-duplicates (146 and 141
  lines). The keyword page uses `useMutation`; the visibility page uses a hand-rolled handler.
- The landing page is one 647-line client component, so its animation code ships to every visitor.

## Related
[architecture](architecture.md) · [backend](backend.md) · [workers](workers.md)
