<!-- Generated: 2026-10-12 | Source: TechWithEmmaYT/AI-SEO-Marketing-SaaS-App@de4843f | Files scanned: 4 | Token estimate: ~1350 -->
# RankSEO — Background workers (Trigger.dev v4)

`trigger.config.ts`: hardcoded project ref, node runtime, default `maxDuration` 3600 (tasks set
300 compute-seconds; checkpointed waits don't count), retries 3 × (1s→10s, factor 2, jitter),
`prismaExtension` legacy mode pinned to 6.19.0, `dirs: ["trigger"]`.

| Task id | File | Payload (Zod `schemaTask`) |
|---------|------|-----------------------------|
| `keyword-research` | `trigger/keyword-research.ts` | `{jobId: ObjectId, keyword, country: ISO-2}` |
| `search-visibility` | `trigger/search-visibility.ts` | `{jobId, website: url, brand, topic}` |
| `hello-world` | `trigger/example.ts` | scaffold leftover, still deployed |

Both tasks first re-load the `Report` and reject payloads that don't match the stored inputs.

## keyword-research
```
COLLECTING 20% "Collecting research sources"
  token = wait.createToken(idempotencyKey "keyword-research-<id>", TTL 24h, timeout 15m)
  snapshot = existing s_/sd_ id from report.brightDataSnapshots ?? BrightData.trigger(
             dataset gd_m7dhdot1vw9a7gc1n (Perplexity), [{prompt: keyword, country}],
             endpoint = token.url, include_errors, force_deliver)        → push snapshot id
COLLECTING 35% → records = wait.forToken(token).unwrap()   (throws on timeout / empty array)
ANALYZING 50%  → generateText(claude-sonnet-4.6, Output.object(keywordReportSchema), T 0.2, ≤10k out)
                 prompt = JSON.stringify(all records)
code metrics   → dedupe source/citation URLs → domain counts & shares → sourceMix (≤6)
                 → topDomains (≤8) → zero-mention competitors forced to share 0/"Not mentioned"
                 → scoreLabel from score; overview counts recomputed
ANALYZING 85%  → Report.update(COMPLETED, 100, result) → metadata → return {…, report}
```

## search-visibility
```
COLLECTING 20% → prompts = generateText(Output.object({prompts: 5}), T 0.2)
                 reject if any prompt contains brand (≥4 chars) or website hostname
  tokens = createToken("search-visibility-chatgpt-<id>"), createToken("…-gemini-<id>") (15m each)
COLLECTING 35% → for ChatGPT (gd_m7aof0k82r803d5bjm, web_search:false), Gemini (gd_mbz66arm2mf9cu856y):
                 reuse brightDataSnapshots[i] ?? trigger(5 prompts, endpoint = token.url) → set array
                 chatgpt = forToken(...).unwrap(); gemini = forToken(...).unwrap()  (sequential awaits)
ANALYZING 65%  → generateText(Output.object(visibilityReportSchema), T 0.1, ≤5k out)
code metrics   → per platform: mentions/citations clamped ≤ 5; score = 60·mention rate + 40·citation rate
                 → overall = mean; label Hidden<10 ≤ Low<35 ≤ Moderate<65 ≤ Strong<85 ≤ Dominant
ANALYZING 85%  → Report.update(COMPLETED, result) → metadata → return {…, report}
```

## Retry / idempotency model
- Snapshot ids are persisted before waiting, and tokens use per-report idempotency keys, so a
  retry after an LLM failure reuses the delivered Bright Data payload instead of paying again.
- **Gap:** visibility prompts are *not* persisted; a retry regenerates them, so the analysis can
  pair new prompts with answers collected for the old ones.
- **Gap:** deliveries are only checked for being a non-empty array. `include_errors` rows
  (blocked or failed prompts) are scored as answers, so a fully blocked platform reads as "0 %".
- Visibility rewrites the whole `brightDataSnapshots` array (last writer wins); keyword uses an
  atomic `$push`.
- A 15-minute token timeout fails the attempt; the retry gets the same idempotent token, so a
  late Bright Data delivery can't be recovered.

## Failure paths
- `onFailure` / `onCancel` → `markJobFailed`: `updateMany({id, type, status ≠ COMPLETED}) → FAILED`
  + metadata `{status, currentStep, errorMessage}` (raw `error.message` is stored and shown).
- `onFailure` fires only when the run function throws its final error. Per Trigger.dev docs,
  `onCancel` doesn't fire while a run is suspended on a token, which is where these runs spend
  most of their time. Cancelled, `maxDuration`-killed and crashed runs are repaired only when
  someone reads `/api/reports*` (`lib/reports.ts`).
- Progress writes (`updateJobProgress`) are unconditional, so they can overwrite `FAILED`.
- `tasks.trigger` is called without an `idempotencyKey`.

## Report status lifecycle (as implemented)
```
create PENDING 5 ─trigger ok─▶ COLLECTING 20/35 ─webhook─▶ ANALYZING 50|65/85 ─save─▶ COMPLETED 100
trigger ok, runId save throws ─▶ FAILED ~~run continues, unguarded writes~~▶ COLLECTING ─▶ COMPLETED
crash between create and trigger ─▶ PENDING forever (no runId → never reconciled, still counts quota)
last attempt throws ─▶ onFailure ─▶ FAILED (counts toward quota)
cancel while waiting / maxDuration / crash ─▶ frozen in COLLECTING until GET /api/reports* ─▶ FAILED
replay of a COMPLETED run >24h later ─▶ COLLECTING ─(no delivery, token timeout)─▶ FAILED
```

## External calls per report
| Product | Bright Data | LLM calls | Notes |
|---------|-------------|-----------|-------|
| Keyword | 1 trigger (1 input) | 1 | raw records include both `answer_text` and `answer_text_markdown` |
| Visibility | 2 triggers (5 inputs each) | 2 | ChatGPT collected with `web_search:false` |

## Related
[architecture](architecture.md) · [backend](backend.md) · [data](data.md)
