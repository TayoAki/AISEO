/**
 * Local stand-ins for Bright Data and Claude so the full pipeline (jobs,
 * webhooks, live progress, quotas) runs without paid API keys. Refused in
 * production by env validation.
 */
import { randomUUID } from "node:crypto";

import type { z } from "zod";

import type { CollectionProvider, SnapshotStatus, TriggerArgs } from "./brightdata";
import type { StructuredLlm, StructuredRequest } from "./llm";

type FakeSnapshot = { createdAt: number; args: TriggerArgs; status: SnapshotStatus };

const COMPETITORS = [
  ["Northwind", "northwind.example"],
  ["Contoso", "contoso.example"],
  ["Fabrikam", "fabrikam.example"],
  ["Tailspin", "tailspin.example"],
] as const;

const PUBLISHERS = ["wikipedia.org", "reddit.com", "youtube.com", "forbes.com", "nytimes.com", "g2.com"];

export class FakeCollectionProvider implements CollectionProvider {
  private readonly snapshots = new Map<string, FakeSnapshot>();

  constructor(private readonly options: { delayMs?: number; notify?: boolean } = {}) {}

  private get delay(): number {
    return this.options.delayMs ?? 4_000;
  }

  async trigger(args: TriggerArgs): Promise<string> {
    const snapshotId = `fake_${randomUUID()}`;
    this.snapshots.set(snapshotId, { createdAt: Date.now(), args, status: "running" });
    if (this.options.notify !== false) {
      setTimeout(() => {
        void fetch(args.notifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot_id: snapshotId, status: "ready" }),
        }).catch((error: unknown) => {
          console.warn("[fake-brightdata] notify failed (is the web app running?)", String(error));
        });
      }, this.delay);
    }
    return snapshotId;
  }

  async progress(snapshotId: string): Promise<SnapshotStatus> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return "ready";
    if (snapshot.status === "canceled") return "canceled";
    return Date.now() - snapshot.createdAt >= this.delay ? "ready" : "running";
  }

  async download(snapshotId: string): Promise<unknown[]> {
    const snapshot = this.snapshots.get(snapshotId);
    const inputs = snapshot?.args.inputs ?? [{ prompt: "example question" }];
    const brand = snapshot?.args.fakeContext?.brand;
    const website = snapshot?.args.fakeContext?.website;
    const host = website ? new URL(website).hostname : undefined;
    // Include "simulate failure" in a keyword or topic to exercise the refund path locally.
    const failAll = inputs.some((input) => /simulate failure/i.test(String(input.prompt ?? "")));

    return inputs.map((input, index) => {
      const prompt = String(input.prompt ?? "question");
      // One deterministic error row per collection exercises error handling.
      if (failAll || (index === inputs.length - 1 && inputs.length > 3)) {
        return { prompt, error: "Answer could not be collected", error_code: "dead_page" };
      }
      const competitor = COMPETITORS[index % COMPETITORS.length]!;
      const other = COMPETITORS[(index + 1) % COMPETITORS.length]!;
      const mentionBrand = brand && index % 2 === 0;
      const answer = [
        `For "${prompt}", most people compare ${competitor[0]} and ${other[0]}.`,
        mentionBrand ? `${brand} is also a solid option with good reviews.` : "",
        "Look at pricing, support and integrations before deciding.",
      ]
        .filter(Boolean)
        .join(" ");
      const citations = [
        `https://${competitor[1]}/guide`,
        `https://${PUBLISHERS[index % PUBLISHERS.length]}/article-${index}`,
        ...(host && index === 0 ? [`https://${host}/`] : []),
      ];
      return { prompt, answer_text: answer, citations, sources: citations.map((url) => ({ url })) };
    });
  }

  async cancel(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId);
    if (snapshot) snapshot.status = "canceled";
  }
}

const INTENTS = ["recommendation", "use_case", "alternatives", "comparison", "purchase"] as const;

export class FakeLlm implements StructuredLlm {
  async generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<z.output<S>> {
    const ctx = request.fakeContext ?? {};
    const topic = String(ctx.topic ?? ctx.keyword ?? "this topic");
    let output: unknown;

    if (request.task === "visibility-prompts") {
      const templates = [
        `What is the best ${topic} for a small team?`,
        `Which ${topic} works well for agencies managing many clients?`,
        `What are good alternatives to the most popular ${topic}?`,
        `How do the leading ${topic} options compare on price and features?`,
        `I'm ready to buy a ${topic}; which one should I choose?`,
      ];
      output = { prompts: INTENTS.map((intent, i) => ({ intent, prompt: templates[i] })) };
    } else if (request.task === "keyword-analysis") {
      const domains = Array.isArray(ctx.domains) ? (ctx.domains as string[]) : [];
      output = {
        scoreBreakdown: { demand: 18, questionDiversity: 14, contentDepth: 12, competition: 11, sourceConfidence: 9 },
        summary: `Demand for ${topic} is healthy and answers lean on a few established brands. No source offers a hands-on comparison with real test data. Publish a data-backed comparison guide.`,
        domainCategories: domains.map((domain) => ({
          domain,
          category: domain.endsWith(".example") ? "Brand site" : "Publisher",
        })),
        competitors: COMPETITORS.map(([name, domain]) => ({ name, domain })),
        promptIdeas: [
          { prompt: `best ${topic} for beginners`, intent: "Recommendation", opportunity: "High" },
          { prompt: `${topic} pricing compared`, intent: "Comparison", opportunity: "Medium" },
          { prompt: `is ${topic} worth it`, intent: "Evaluation", opportunity: "Low" },
        ],
        keywordClusters: [
          { cluster: "Buying guides", keywords: [{ keyword: `best ${topic}`, relevance: 92 }, { keyword: `${topic} reviews`, relevance: 81 }] },
          { cluster: "How-to", keywords: [{ keyword: `how to choose ${topic}`, relevance: 77 }] },
        ],
        ...(ctx.paid
          ? {
              insights: {
                keyFindings: ["Answers cite brand sites more than independent reviews."],
                contentGaps: ["No source publishes side-by-side test results."],
                quickWins: ["Add an FAQ section that answers the top three questions directly."],
                contentPlan: [{ title: `The ${topic} buyer's guide`, format: "Long-form guide", angle: "Tested comparisons" }],
              },
            }
          : {}),
      };
    } else {
      output = {
        summary: `${String(ctx.brand ?? "Your brand")} appears in some answers but competitors are recommended more often. Earn citations on the publishers AI assistants already trust.`,
        competitors: COMPETITORS.map(([name, domain]) => ({ name, domain })),
        ...(ctx.paid
          ? {
              recommendations: [
                { title: "Publish a comparison page", detail: "Answer the comparison prompts directly with a fair, sourced table.", priority: "High" },
                { title: "Get listed on review sites", detail: "Assistants cite review platforms; collect reviews there.", priority: "Medium" },
              ],
            }
          : {}),
      };
    }
    return request.schema.parse(output);
  }
}
