import { z } from "zod";

/**
 * Normalizes Bright Data AI-scraper records (Perplexity, ChatGPT, Gemini).
 * Collections are requested with include_errors, so error rows are counted
 * and dropped here; they are never treated as evidence.
 */
export type AnswerRecord = {
  prompt: string | null;
  answer: string;
  sources: string[];
};

export type ParsedCollection = {
  total: number;
  answers: AnswerRecord[];
  errorRows: number;
  errorSamples: string[];
};

const MAX_ANSWER_CHARS = 12_000;

const rawRecordSchema = z.looseObject({
  prompt: z.string().nullish(),
  input: z.looseObject({ prompt: z.string().nullish() }).nullish(),
  answer_text: z.string().nullish(),
  answer_text_markdown: z.string().nullish(),
  answer: z.string().nullish(),
  sources: z.array(z.unknown()).nullish(),
  citations: z.array(z.unknown()).nullish(),
  links_attached: z.array(z.unknown()).nullish(),
  references: z.array(z.unknown()).nullish(),
  error: z.unknown().optional(),
  error_code: z.unknown().optional(),
});

function urlFrom(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["url", "link", "href", "source_url", "source"]) {
      if (typeof record[key] === "string") return record[key] as string;
    }
  }
  return null;
}

export function extractUrls(...lists: Array<unknown[] | null | undefined>): string[] {
  const urls = new Set<string>();
  for (const list of lists) {
    for (const item of list ?? []) {
      const candidate = urlFrom(item);
      if (!candidate) continue;
      try {
        const url = new URL(candidate);
        if (url.protocol === "http:" || url.protocol === "https:") urls.add(url.toString());
      } catch {
        // Not a URL: ignore.
      }
    }
  }
  return [...urls];
}

function errorSummary(record: z.infer<typeof rawRecordSchema>): string {
  const parts = [record.error_code, record.error].filter((p) => p !== undefined && p !== null);
  return parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(": ").slice(0, 200) || "empty answer";
}

export function parseCollection(records: unknown): ParsedCollection {
  const result: ParsedCollection = { total: 0, answers: [], errorRows: 0, errorSamples: [] };
  if (!Array.isArray(records)) return result;

  for (const item of records) {
    result.total += 1;
    const parsed = rawRecordSchema.safeParse(item);
    if (!parsed.success) {
      result.errorRows += 1;
      continue;
    }
    const record = parsed.data;
    const answer = (record.answer_text ?? record.answer_text_markdown ?? record.answer ?? "").trim();
    if (!answer) {
      result.errorRows += 1;
      if (result.errorSamples.length < 5) result.errorSamples.push(errorSummary(record));
      continue;
    }
    result.answers.push({
      prompt: record.prompt ?? record.input?.prompt ?? null,
      answer: answer.slice(0, MAX_ANSWER_CHARS),
      sources: extractUrls(record.sources, record.citations, record.links_attached, record.references),
    });
  }
  return result;
}

/** Hostname without "www.", lowercased; null for invalid URLs. */
export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True if `host` is `domain` or a subdomain of it. */
export function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const d = domain.toLowerCase().replace(/^www\./, "");
  return h === d || h.endsWith(`.${d}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive whole-word match that works for names with punctuation. */
export function mentions(text: string, term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length < 2) return false;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
}

/** First sentence-ish excerpt containing `term`, for evidence display. */
export function excerptAround(text: string, term: string, maxLength = 240): string | null {
  const index = text.toLowerCase().indexOf(term.trim().toLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  const end = Math.min(text.length, start + maxLength);
  const excerpt = text.slice(start, end).trim().replace(/\s+/g, " ");
  return end < text.length ? `${excerpt}…` : excerpt;
}
