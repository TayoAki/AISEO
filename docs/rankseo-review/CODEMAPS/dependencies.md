<!-- Generated: 2026-10-12 | Source: TechWithEmmaYT/AI-SEO-Marketing-SaaS-App@de4843f | Files scanned: package.json, package-lock.json, 24 source files | Token estimate: ~1050 -->
# RankSEO — External services, libraries, configuration

## External services
| Service | Used by | Purpose | Credential |
|---------|---------|---------|------------|
| MongoDB (Atlas per `.env.example`) | Next app + tasks | primary store via Prisma | `DATABASE_URL` |
| Trigger.dev Cloud v4 | Next app (`tasks.trigger`, `runs.retrieve`, `auth.createPublicToken`) + browser realtime | job orchestration, waitpoints, realtime | `TRIGGER_SECRET_KEY` (read implicitly by the SDK; missing from the repo's env docs) |
| Bright Data Datasets API v3 | tasks only | scrape Perplexity / ChatGPT / Gemini answers, webhook delivery | `BRIGHT_DATA_API_TOKEN` |
| Vercel AI Gateway | tasks only | `anthropic/claude-sonnet-4.6` structured output | `AI_GATEWAY_API_KEY` (implicit) |
| Stripe | Next app via `@better-auth/stripe` | checkout, portal, subscription webhooks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_{PRO,PLUS}_{MONTHLY,YEARLY}_PRICE_ID` |
| flagsapi.com | `next/image` remote pattern | country flags | — |

Better Auth also needs `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (implicit). Env is split across
two runtimes: Vercel/Node (auth, Stripe, Trigger key, DB) and Trigger.dev (DB, Bright Data, AI
Gateway). Nothing validates env at startup; Stripe values use `!` non-null assertions.

## Libraries that shape the code
| Package | Version | Role |
|---------|---------|------|
| `next` | 16.2.12 | App Router, `proxy.ts`, route handlers |
| `react` / `react-dom` | 19.2.4 | UI |
| `better-auth` + `@better-auth/stripe` | ^1.6.25 | sessions, email+password, subscriptions |
| `@better-auth/prisma-adapter` | 1.6.25 (transitive) | **phantom dependency**: imported by `lib/auth.ts`, not declared |
| `@prisma/client` / `prisma` | 6.19 → resolves 6.19.3 (classic engine) | ORM; client output `generated/prisma`; the Trigger.dev build pins 6.19.0 |
| `@trigger.dev/sdk` / `react-hooks` / `build` | 4.5.9 (exact) | tasks, waitpoints, realtime hooks, Prisma build extension |
| `ai` | ^7.0.42 | `generateText` + `Output.object` through AI Gateway |
| `zod` | ^4.4.3 | API, task payload and LLM output schemas |
| `@tanstack/react-query` | ^5.101 | client data fetching |
| `react-hook-form` + `@hookform/resolvers` | ^7.62 / ^5.2 | forms with Zod |
| `@base-ui/react` + shadcn style `base-sera` | ^1.6 | UI primitives in `components/ui` |
| `tailwindcss` v4, `tw-animate-css`, `next-themes`, `sonner`, `lucide-react` | — | styling, theme, toasts, icons |
| `gsap` + `@gsap/react` | ^3.15 | landing-page animation |
| `shadcn` | ^4.16 | **CLI declared as a runtime dependency**; pulls express, hono, MCP SDK into prod installs |
| `dotenv` | ^17 | only `prisma.config.ts` |

## Quality-gate results (run 2026-10-12 on a scratch copy, `npm ci --ignore-scripts`)
| Gate | Result |
|------|--------|
| `prisma validate` / `prisma generate` | pass |
| `tsc --noEmit` | pass, 0 errors |
| `eslint` on source (excluding `generated/**`) | 0 errors, 2 warnings (`components/site-header.tsx` unused vars) |
| `npm run lint` as configured | 497 errors / 1,741 warnings, all from the gitignored but un-ignored `generated/prisma` |
| `npm audit --omit=dev` | 44 advisories: 2 critical, 23 high, 18 moderate, 1 low |
| `next build` (dummy env) | **fails**: `components/site-header.tsx` imports `usePathname`/`useRef` into a Server Component graph. Also warns that `generated/prisma` causes whole-project file tracing |
| Tests | none exist |

Audit highlights: `next@16.2.12` is inside the ranges of critical advisories GHSA-2xp9-vwfh-vxw4
(Image Optimization RCE with AVIF), GHSA-p293-qw3h-jr36 (Windows-hosted RCE) and GHSA-vcvr-r3jv-pc5j
(`next/og`), plus high SSRF GHSA-cjq9-62q9-8jv4 in Image Optimization; fixed in **16.4.0**
(non-major). `proxy-addr` (critical) and `hono` arrive via the `shadcn` CLI → MCP SDK → express;
`socket.io`/`engine.io` via `@trigger.dev/core`.

## Related
[architecture](architecture.md) · [backend](backend.md) · [workers](workers.md)
