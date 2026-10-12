import { z } from "zod";

/**
 * Stored report results (report.result), versioned and validated on read so
 * a schema change can never silently break old reports. Paid sections are
 * optional: they are only generated for reports created on a paid plan.
 */
export const RESULT_VERSION = 1;

const share = z.number().min(0).max(100);
const count = z.number().int().min(0);

export const keywordScoreLabels = ["Needs work", "Promising", "Strong", "Excellent"] as const;
export const visibilityScoreLabels = ["Hidden", "Low", "Moderate", "Strong", "Dominant"] as const;

export const keywordInsightsSchema = z.object({
  keyFindings: z.array(z.string()),
  contentGaps: z.array(z.string()),
  quickWins: z.array(z.string()),
  contentPlan: z.array(z.object({ title: z.string(), format: z.string(), angle: z.string() })),
});

export const keywordResultSchema = z.object({
  version: z.literal(1),
  score: z.number().int().min(0).max(100),
  scoreLabel: z.enum(keywordScoreLabels),
  scoreBreakdown: z.object({
    demand: count,
    questionDiversity: count,
    contentDepth: count,
    competition: count,
    sourceConfidence: count,
  }),
  summary: z.string(),
  coverage: z.object({ answers: count, errorRows: count, sources: count, uniqueDomains: count }),
  topDomains: z.array(z.object({ domain: z.string(), category: z.string(), sources: count, share })),
  sourceMix: z.array(z.object({ category: z.string(), sources: count, share })),
  competitors: z.array(
    z.object({
      name: z.string(),
      domain: z.string().nullable(),
      mentions: count,
      share,
      strength: z.enum(["Leading", "Established", "Emerging", "Not mentioned"]),
    }),
  ),
  promptIdeas: z.array(
    z.object({ prompt: z.string(), intent: z.string(), opportunity: z.enum(["High", "Medium", "Low"]) }),
  ),
  keywordClusters: z.array(
    z.object({ cluster: z.string(), keywords: z.array(z.object({ keyword: z.string(), relevance: share })) }),
  ),
  insights: keywordInsightsSchema.optional(),
});

export const visibilityPlatforms = ["chatgpt", "gemini"] as const;
export type VisibilityPlatform = (typeof visibilityPlatforms)[number];

export const visibilityResultSchema = z.object({
  version: z.literal(1),
  score: z.number().int().min(0).max(100),
  scoreLabel: z.enum(visibilityScoreLabels),
  summary: z.string(),
  platforms: z.array(
    z.object({
      platform: z.enum(visibilityPlatforms),
      score: z.number().int().min(0).max(100),
      answered: count,
      failed: count,
      mentions: count,
      citations: count,
    }),
  ),
  prompts: z.array(
    z.object({
      prompt: z.string(),
      results: z.array(
        z.object({
          platform: z.enum(visibilityPlatforms),
          answered: z.boolean(),
          mentioned: z.boolean(),
          cited: z.boolean(),
          excerpt: z.string().nullable(),
        }),
      ),
    }),
  ),
  competitors: z.array(
    z.object({ name: z.string(), domain: z.string().nullable(), mentions: count, platforms: z.array(z.enum(visibilityPlatforms)) }),
  ),
  recommendations: z
    .array(z.object({ title: z.string(), detail: z.string(), priority: z.enum(["High", "Medium", "Low"]) }))
    .optional(),
});

export type KeywordResult = z.infer<typeof keywordResultSchema>;
export type KeywordInsights = z.infer<typeof keywordInsightsSchema>;
export type VisibilityResult = z.infer<typeof visibilityResultSchema>;

export function keywordScoreLabel(score: number): KeywordResult["scoreLabel"] {
  if (score < 40) return "Needs work";
  if (score < 65) return "Promising";
  if (score < 85) return "Strong";
  return "Excellent";
}

export function visibilityScoreLabel(score: number): VisibilityResult["scoreLabel"] {
  if (score < 10) return "Hidden";
  if (score < 35) return "Low";
  if (score < 65) return "Moderate";
  if (score < 85) return "Strong";
  return "Dominant";
}
