import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import { usageFromMessage, type LlmUsage } from "./costs";
import { NonRetryableError } from "./errors";

export type LlmTask = "visibility-prompts" | "keyword-analysis" | "visibility-analysis";

export type StructuredRequest<S extends z.ZodType> = {
  task: LlmTask;
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
  /** Request timeout; defaults to 4 minutes. */
  timeoutMs?: number;
  /** Structured hints for the fake provider; ignored by the live client. */
  fakeContext?: Record<string, unknown>;
  /** Receives the billed attempts of every response, including refused or truncated ones. */
  onUsage?: (attempts: LlmUsage[]) => Promise<void>;
};

export interface StructuredLlm {
  generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.output<S>>;
}

export type AnthropicLlmOptions = {
  apiKey: string;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  /** Server-side refusal fallback (`fallbacks: "default"`). */
  refusalFallback: boolean;
};

/**
 * Claude via the official SDK with structured outputs. Thinking is adaptive
 * by default on current models; `effort` controls depth (and cost). No
 * sampling parameters are sent: current models reject non-default values.
 */
export class AnthropicLlm implements StructuredLlm {
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicLlmOptions) {
    // No SDK-level retries: they can wait out any retry-after header, which
    // could outlive the pg-boss job and start a second paid call in parallel.
    // Jobs retry with bounded backoff instead, and each request's timeout
    // stays well under its job's expireInSeconds.
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: 0, timeout: 4 * 60 * 1000 });
  }

  async generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.output<S>> {
    let message;
    try {
      message = await this.client.beta.messages.parse(
        {
          model: this.options.model,
          max_tokens: request.maxTokens ?? 16_000,
          ...(this.options.refusalFallback
            ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
            : {}),
          output_config: {
            effort: this.options.effort,
            format: betaZodOutputFormat(request.schema),
          },
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: request.prompt }],
        },
        { timeout: request.timeoutMs ?? 4 * 60 * 1000 },
      );
    } catch (error) {
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError ||
        error instanceof Anthropic.NotFoundError
      ) {
        throw new NonRetryableError("CONFIGURATION", `Anthropic ${error.status}: ${error.message}`);
      }
      if (error instanceof Anthropic.BadRequestError) {
        throw new NonRetryableError("ANALYSIS_FAILED", `Anthropic 400 (${request.task}): ${error.message}`);
      }
      // Rate limits, 5xx, timeouts and connection errors bubble up so the job
      // retries with backoff.
      throw error;
    }

    // Every response is billed, whatever its outcome: report usage before judging it.
    await request.onUsage?.(usageFromMessage(message));

    if (message.stop_reason === "refusal") {
      const category = message.stop_details?.category ?? "unspecified";
      throw new NonRetryableError("ANALYSIS_DECLINED", `Model declined ${request.task} (category: ${category})`);
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error(`Model output for ${request.task} hit max_tokens before finishing`);
    }
    if (message.parsed_output === null || message.parsed_output === undefined) {
      throw new Error(`Model returned no parseable output for ${request.task}`);
    }
    // Structured outputs guarantee the shape; Zod re-checks every constraint.
    return request.schema.parse(message.parsed_output);
  }
}
