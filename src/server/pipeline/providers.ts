import type { KeywordInput, VisibilityInput } from "@/lib/report-input";

import type { Env } from "../env";
import {
  BrightDataClient,
  chatgptInputs,
  geminiInputs,
  perplexityInputs,
  type CollectionProvider,
} from "./brightdata";
import { FakeCollectionProvider, FakeLlm } from "./fake-providers";
import { AnthropicLlm, type StructuredLlm } from "./llm";

export type Providers = {
  collections: CollectionProvider;
  llm: StructuredLlm;
  /** Bright Data list price per delivered record, for cost reporting. */
  costPerRecordUsd: number;
};
export type Platform = "perplexity" | "chatgpt" | "gemini";

export function createProviders(env: Env): Providers {
  if (env.PROVIDER_MODE === "fake") {
    return { collections: new FakeCollectionProvider({ notify: true }), llm: new FakeLlm(), costPerRecordUsd: 0 };
  }
  if (!env.BRIGHTDATA_API_TOKEN) throw new Error("BRIGHTDATA_API_TOKEN is required when PROVIDER_MODE=live");
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required when PROVIDER_MODE=live");
  return {
    collections: new BrightDataClient(env.BRIGHTDATA_API_TOKEN),
    llm: new AnthropicLlm({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      effort: env.ANTHROPIC_EFFORT,
      refusalFallback: env.ANTHROPIC_REFUSAL_FALLBACK,
    }),
    costPerRecordUsd: env.BRIGHTDATA_COST_PER_1K_RECORDS / 1000,
  };
}

export function platformsFor(type: "keyword" | "visibility"): Platform[] {
  return type === "keyword" ? ["perplexity"] : ["chatgpt", "gemini"];
}

export function collectionRequest(
  env: Env,
  input: KeywordInput | VisibilityInput,
  platform: Platform,
  prompts: string[] | null,
): { datasetId: string; inputs: Record<string, unknown>[] } {
  if (platform === "perplexity") {
    if (input.type !== "keyword") throw new Error("perplexity collections are for keyword reports");
    return { datasetId: env.BRIGHTDATA_DATASET_PERPLEXITY, inputs: perplexityInputs(input.keyword, input.country) };
  }
  if (!prompts || prompts.length === 0) throw new Error(`${platform} collection requires generated prompts`);
  return platform === "chatgpt"
    ? { datasetId: env.BRIGHTDATA_DATASET_CHATGPT, inputs: chatgptInputs(prompts, env.BRIGHTDATA_CHATGPT_WEB_SEARCH) }
    : { datasetId: env.BRIGHTDATA_DATASET_GEMINI, inputs: geminiInputs(prompts) };
}
