import { describe, expect, it } from "vitest";

import { claudeCostMicros, usageFromMessage } from "@/server/pipeline/costs";

describe("claudeCostMicros", () => {
  it("prices Sonnet 5.5 at $2 / $10 per million tokens", () => {
    const micros = claudeCostMicros({
      model: "claude-sonnet-5-5",
      inputTokens: 6_000,
      outputTokens: 3_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(micros).toBe(42_000); // $0.042
  });

  it("prices cache reads and writes separately", () => {
    const micros = claudeCostMicros({
      model: "claude-sonnet-5-5",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 1_000_000,
    });
    expect(micros).toBe(100_000 + 2_500_000);
  });

  it("returns null for a model without a known price", () => {
    expect(claudeCostMicros({ model: "fake", inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull();
  });
});

describe("usageFromMessage", () => {
  it("uses top-level usage when no fallback ran", () => {
    const attempts = usageFromMessage({
      model: "claude-sonnet-5-5",
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: null, cache_creation_input_tokens: 7 },
    });
    expect(attempts).toEqual([
      { model: "claude-sonnet-5-5", inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 7 },
    ]);
  });

  it("bills each attempt at its own model when a fallback served the request", () => {
    const attempts = usageFromMessage({
      model: "claude-sonnet-5",
      usage: {
        input_tokens: 900,
        output_tokens: 400,
        iterations: [
          { type: "message", model: "claude-sonnet-5-5", input_tokens: 900, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
          { type: "fallback_message", model: "claude-sonnet-5", input_tokens: 900, output_tokens: 400, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        ],
      },
    });
    expect(attempts.map((a) => [a.model, a.outputTokens])).toEqual([
      ["claude-sonnet-5-5", 20],
      ["claude-sonnet-5", 400],
    ]);
  });
});
