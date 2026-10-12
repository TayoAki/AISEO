/**
 * What each report costs to produce (COGS), recorded per provider call in
 * report_usage. Prices are list prices in USD per million tokens; update
 * them when Anthropic's pricing changes (platform.claude.com/docs/en/about-claude/pricing).
 */
import { eq, sql } from "drizzle-orm";

import type { Executor } from "../db/client";
import { reportUsage } from "../db/schema";

type ClaudePrice = { input: number; output: number; cacheWrite: number; cacheRead: number };

/** USD per million tokens. Cache writes use the 5-minute rate (what cache_control ephemeral uses). */
export const CLAUDE_PRICES: Record<string, ClaudePrice> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  // Prompts up to 100K tokens; ours are far below that.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

/** Token usage of one billed model attempt (a fallback adds a second attempt). */
export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/** Cost in micro-dollars (USD x 1e6), or null for a model without a known price. */
export function claudeCostMicros(usage: LlmUsage): number | null {
  const price = CLAUDE_PRICES[usage.model];
  if (!price) return null;
  // $/MTok equals micro-dollars per token.
  return Math.round(
    usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite,
  );
}

type UsageCounts = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

type MessageUsage = UsageCounts & {
  iterations?: Array<UsageCounts & { type: string; model?: string | null }> | null;
};

/**
 * Billed attempts in a Messages API response. With a server-side refusal
 * fallback, `usage.iterations` is the per-attempt source of truth (each
 * attempt billed at its own model's rates); otherwise top-level usage covers
 * the single attempt.
 */
export function usageFromMessage(message: { model: string; usage: MessageUsage }): LlmUsage[] {
  const toUsage = (counts: UsageCounts, model: string): LlmUsage => ({
    model,
    inputTokens: counts.input_tokens,
    outputTokens: counts.output_tokens,
    cacheReadTokens: counts.cache_read_input_tokens ?? 0,
    cacheWriteTokens: counts.cache_creation_input_tokens ?? 0,
  });
  const attempts = (message.usage.iterations ?? []).filter(
    (entry) => entry.type === "message" || entry.type === "fallback_message",
  );
  if (attempts.length === 0) return [toUsage(message.usage, message.model)];
  return attempts.map((entry) => toUsage(entry, entry.model ?? message.model));
}

export type UsageRow = {
  provider: "anthropic" | "brightdata";
  task: string;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  records?: number;
  costMicros: number | null;
};

/**
 * Records usage for a report. Never throws: the money is already spent, and
 * failing the job here would retry it and spend it again.
 */
export async function recordUsage(db: Executor, reportId: string, rows: UsageRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    await db.insert(reportUsage).values(rows.map((row) => ({ reportId, ...row })));
  } catch (error) {
    console.error("[costs] could not record usage", { reportId, rows, error: (error as Error).message });
  }
}

export function claudeUsageRows(task: string, attempts: LlmUsage[]): UsageRow[] {
  return attempts.map((usage) => ({ provider: "anthropic", task, ...usage, costMicros: claudeCostMicros(usage) }));
}

/** Total recorded cost of a report in USD (unpriced rows count as zero). */
export async function reportCostUsd(db: Executor, reportId: string): Promise<number> {
  const [row] = await db
    .select({ micros: sql<string | null>`sum(${reportUsage.costMicros})` })
    .from(reportUsage)
    .where(eq(reportUsage.reportId, reportId));
  return Number(row?.micros ?? 0) / 1_000_000;
}
