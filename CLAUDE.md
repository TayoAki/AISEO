# AISEO: notes for coding agents

@AGENTS.md

Next.js 16 app plus a pg-boss worker on one Postgres. Read `docs/USER-JOURNEYS.md` before changing a flow; keep it accurate when behavior changes.

## Commands

- `npm run typecheck`, `npm run lint`, `npm test` (needs local Postgres; tests use the `aiseo_test` database and fake providers)
- `npm run dev` + `npm run dev:worker` for the full flow locally (fake Bright Data and Claude, emails printed to the console)
- `npm run db:generate` after editing `src/server/db/schema/*`; commit the generated SQL in `drizzle/`

## Rules that keep the system correct

- **Report status** changes only through `src/server/reports/state.ts` (`advanceReport`, `completeReport`, `failReport`). They only touch active reports and settle the credit in the same transaction.
- **Credits** change only through `src/server/quota/quota.ts` (`reserveUnit`, `settleReservation`). Never update `usage_bucket` directly. Every path that ends a report must commit or release exactly once.
- **Paywall**: reports reach browsers only through `serializeReport` / `serializeReportSummary` / `serializeProgress` in `src/server/reports/serialize.ts`. Never return `report.result` or `failure_detail` directly.
- **Ownership**: read reports with the owner-scoped helpers in `src/server/reports/queries.ts`.
- **Pipeline jobs** (`src/server/pipeline/jobs.ts`) must be idempotent: check state first, persist anything expensive (prompts, snapshot ids) before the next step. Throw `NonRetryableError` with a `FAILURE_MESSAGES` code for permanent failures; anything else is retried, then dead-lettered.
- **Configuration** goes through `getEnv()` in `src/server/env.ts`. A new variable also needs `.env.example`, `.railway/railway.ts` (with `preserve()` for secrets) and, if production requires it, the right role in `assertProductionConfig`.
- **Input validation**: report inputs use the Zod schemas in `src/lib/report-input.ts`, shared by the forms and the API.
- **Migrations** must be backward compatible: web and worker deploy independently.
- **Claude calls** go through `src/server/pipeline/llm.ts` (structured output, refusal handling, timeouts sized below the analyze job's expiry), via the per-report `meteredLlm` in jobs so each call's cost lands in `report_usage`. A new paid provider call must record its cost too (`src/server/pipeline/costs.ts`).

## Next.js 16 specifics used here

- `src/proxy.ts` replaces `middleware.ts`; it only does cookie-presence redirects. Real auth checks happen in pages (`requireUser`/`getViewer`) and route handlers (`requireApiUser`).
- `params` and `searchParams` are Promises in pages and route handlers.
- `src/instrumentation.ts` validates production configuration at boot.
