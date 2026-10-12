import { z } from "zod";

/** Shared by client forms and the API so both validate identically. */

export const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["IE", "Ireland"],
  ["NZ", "New Zealand"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["SE", "Sweden"],
  ["IN", "India"],
  ["SG", "Singapore"],
  ["JP", "Japan"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["ZA", "South Africa"],
  ["NG", "Nigeria"],
  ["AE", "United Arab Emirates"],
] as const;

export type CountryCode = (typeof COUNTRIES)[number][0];
const COUNTRY_CODES = COUNTRIES.map(([code]) => code) as [CountryCode, ...CountryCode[]];

export function countryName(code: string): string {
  return COUNTRIES.find(([c]) => c === code)?.[1] ?? code;
}

/** Accepts "example.com" or a full URL; stores a normalized https URL. */
const websiteSchema = z
  .string()
  .trim()
  .min(3, "Enter your website")
  .max(300, "That URL is too long")
  .transform((value, ctx) => {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid website, like example.com" });
      return z.NEVER;
    }
    const host = url.hostname.toLowerCase();
    const looksLikeDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !/^\d+(\.\d+){3}$/.test(host);
    if (!looksLikeDomain || host === "localhost") {
      ctx.addIssue({ code: "custom", message: "Enter a public website domain, like example.com" });
      return z.NEVER;
    }
    return `${url.protocol}//${host}${url.pathname === "/" ? "" : url.pathname}`;
  });

export const keywordInputSchema = z.object({
  type: z.literal("keyword"),
  keyword: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(100, "Keep it under 100 characters"),
  country: z.enum(COUNTRY_CODES, { message: "Choose a country" }),
});

export const visibilityInputSchema = z.object({
  type: z.literal("visibility"),
  website: websiteSchema,
  brand: z.string().trim().min(2, "Use at least 2 characters").max(80, "Keep it under 80 characters"),
  topic: z
    .string()
    .trim()
    .min(3, "Describe your category in a few words")
    .max(160, "Keep it under 160 characters"),
});

export const reportInputSchema = z.discriminatedUnion("type", [keywordInputSchema, visibilityInputSchema]);

export type KeywordInput = z.output<typeof keywordInputSchema>;
export type VisibilityInput = z.output<typeof visibilityInputSchema>;
export type ReportInput = z.output<typeof reportInputSchema>;
export type ReportType = ReportInput["type"];

export function reportTitle(input: ReportInput): string {
  return input.type === "keyword" ? input.keyword : `${input.brand} · ${input.topic}`;
}

export function hostnameOf(website: string): string {
  return new URL(website).hostname.replace(/^www\./, "");
}
