import { describe, expect, it } from "vitest";
import type { z } from "zod";

import type { VisibilityInput } from "@/lib/report-input";
import { buildKeywordResult, collectKeywordEvidence } from "@/server/pipeline/keyword";
import type { StructuredLlm, StructuredRequest } from "@/server/pipeline/llm";
import { parseCollection } from "@/server/pipeline/records";
import { analyzeVisibility, generateVisibilityPrompts } from "@/server/pipeline/visibility";

/** LLM stub returning a fixed object for every task (validated by the caller's schema). */
function stubLlm(output: Record<string, unknown>): StructuredLlm {
  return {
    async generate<S extends z.ZodType>(request: StructuredRequest<S>) {
      return request.schema.parse(output);
    },
  };
}

describe("buildKeywordResult", () => {
  const parsed = parseCollection([
    { prompt: "p1", answer_text: "Acme and Globex lead. Acme is popular.", citations: ["https://acme.com/a", "https://news.com/1"] },
    { prompt: "p2", answer_text: "Globex is fine.", citations: ["https://acme.com/b", "https://news.com/1"] },
    { prompt: "p3", error: "failed" },
  ]);
  const evidence = collectKeywordEvidence(parsed);
  const llmOutput = {
    scoreBreakdown: { demand: 40, questionDiversity: 10, contentDepth: 10, competition: 10, sourceConfidence: 10 },
    summary: " Summary. ",
    domainCategories: [{ domain: "acme.com", category: "Brand site" as const }],
    competitors: [
      { name: "Acme", domain: "https://www.acme.com/" },
      { name: "Globex", domain: null },
      { name: "Initech", domain: null },
      { name: "acme", domain: null },
    ],
    promptIdeas: [],
    keywordClusters: [{ cluster: "c", keywords: [{ keyword: "k", relevance: 150 }] }],
  };

  it("computes sources and domains in code, deduplicating URLs", () => {
    const result = buildKeywordResult(evidence, llmOutput, false);
    expect(result.coverage).toEqual({ answers: 2, errorRows: 1, sources: 3, uniqueDomains: 2 });
    expect(result.topDomains[0]).toEqual({ domain: "acme.com", category: "Brand site", sources: 2, share: 66.7 });
    expect(result.topDomains[1]?.category).toBe("Other");
  });

  it("counts competitor mentions from the evidence, not the model", () => {
    const result = buildKeywordResult(evidence, llmOutput, false);
    const byName = Object.fromEntries(result.competitors.map((c) => [c.name, c]));
    expect(byName.Acme?.mentions).toBe(2);
    expect(byName.Acme?.domain).toBe("acme.com");
    expect(byName.Globex?.mentions).toBe(2);
    expect(byName.Initech).toMatchObject({ mentions: 0, share: 0, strength: "Not mentioned" });
    expect(result.competitors).toHaveLength(3);
  });

  it("clamps model-supplied numbers and omits insights for free reports", () => {
    const result = buildKeywordResult(evidence, llmOutput, false);
    expect(result.scoreBreakdown.demand).toBe(25);
    expect(result.score).toBe(65);
    expect(result.scoreLabel).toBe("Strong");
    expect(result.keywordClusters[0]?.keywords[0]?.relevance).toBe(100);
    expect(result.insights).toBeUndefined();
    expect(result.summary).toBe("Summary.");
  });

  it("caps source confidence when there are no sources", () => {
    const noSources = collectKeywordEvidence(parseCollection([{ answer_text: "Text only" }]));
    expect(buildKeywordResult(noSources, llmOutput, false).scoreBreakdown.sourceConfidence).toBe(3);
  });
});

describe("analyzeVisibility", () => {
  const input: VisibilityInput = { type: "visibility", website: "https://acme.com", brand: "Acme", topic: "project tools" };
  const prompts = ["q1 question?", "q2 question?", "q3 question?", "q4 question?", "q5 question?"];
  const llm = stubLlm({ summary: "s", competitors: [{ name: "Globex", domain: null }, { name: "Acme", domain: null }] });

  it("excludes errored prompts from the denominator", async () => {
    const chatgpt = parseCollection([
      { prompt: "q1 question?", answer_text: "Acme is great.", citations: ["https://acme.com/pricing"] },
      { prompt: "q2 question?", answer_text: "Globex wins." },
      { prompt: "q3 question?", error: "blocked" },
      { prompt: "q4 question?", error: "blocked" },
      { prompt: "q5 question?", error: "blocked" },
    ]);
    const result = await analyzeVisibility({ input, prompts, collections: { chatgpt }, llm, paid: false });
    const cg = result.platforms.find((p) => p.platform === "chatgpt")!;
    expect(cg).toMatchObject({ answered: 2, failed: 3, mentions: 1, citations: 1 });
    expect(cg.score).toBe(50);
    expect(result.prompts[0]?.results[0]).toMatchObject({ answered: true, mentioned: true, cited: true });
    expect(result.prompts[0]?.results[0]?.excerpt).toContain("Acme");
  });

  it("does not let a fully blocked platform drag the score to zero", async () => {
    const chatgpt = parseCollection(prompts.map((p) => ({ prompt: p, answer_text: "Acme is recommended." })));
    const gemini = parseCollection(prompts.map((p) => ({ prompt: p, error: "blocked" })));
    const result = await analyzeVisibility({ input, prompts, collections: { chatgpt, gemini }, llm, paid: false });
    expect(result.platforms.find((p) => p.platform === "gemini")).toMatchObject({ answered: 0, failed: 5, score: 0 });
    expect(result.score).toBe(60);
    expect(result.scoreLabel).toBe("Moderate");
  });

  it("removes the audited brand from competitors and drops unmentioned ones", async () => {
    const chatgpt = parseCollection(prompts.map((p) => ({ prompt: p, answer_text: "Globex and Acme." })));
    const result = await analyzeVisibility({ input, prompts, collections: { chatgpt }, llm, paid: false });
    expect(result.competitors.map((c) => c.name)).toEqual(["Globex"]);
    expect(result.recommendations).toBeUndefined();
  });

  it("fails without retrying when no platform answered", async () => {
    const gemini = parseCollection(prompts.map((p) => ({ prompt: p, error: "blocked" })));
    await expect(analyzeVisibility({ input, prompts, collections: { gemini }, llm, paid: false })).rejects.toMatchObject({
      name: "NonRetryableError",
      code: "NO_USABLE_ANSWERS",
    });
  });
});

describe("generateVisibilityPrompts", () => {
  const input: VisibilityInput = { type: "visibility", website: "https://acme.com", brand: "Acme", topic: "project tools" };
  const intents = ["recommendation", "use_case", "alternatives", "comparison", "purchase"] as const;

  it("returns five neutral prompts in intent order", async () => {
    const llm = stubLlm({ prompts: intents.map((intent) => ({ intent, prompt: `A neutral ${intent} question about tools?` })) });
    const prompts = await generateVisibilityPrompts(llm, input);
    expect(prompts).toHaveLength(5);
    expect(prompts[0]).toContain("recommendation");
  });

  it("rejects plans that mention the audited brand (so the job retries)", async () => {
    const llm = stubLlm({
      prompts: intents.map((intent, i) => ({ intent, prompt: i === 2 ? "What are alternatives to Acme?" : `Neutral ${intent} question?` })),
    });
    await expect(generateVisibilityPrompts(llm, input)).rejects.toThrow(/4\/5/);
  });
});
