import { describe, expect, it } from "vitest";

import { domainOf, excerptAround, extractUrls, hostMatches, mentions, parseCollection } from "@/server/pipeline/records";

describe("parseCollection", () => {
  it("counts error rows and never treats them as answers", () => {
    const parsed = parseCollection([
      { prompt: "a", answer_text: "Real answer", citations: ["https://example.com/x"] },
      { prompt: "b", error: "blocked", error_code: "captcha" },
      { prompt: "c", answer_text: "   " },
      "not an object",
    ]);
    expect(parsed.total).toBe(4);
    expect(parsed.answers).toHaveLength(1);
    expect(parsed.errorRows).toBe(3);
    expect(parsed.errorSamples[0]).toContain("captcha");
  });

  it("reads the answer from the markdown field when plain text is missing", () => {
    const parsed = parseCollection([{ input: { prompt: "q" }, answer_text_markdown: "**Bold** answer" }]);
    expect(parsed.answers[0]).toMatchObject({ prompt: "q", answer: "**Bold** answer" });
  });

  it("returns an empty result for non-array payloads", () => {
    expect(parseCollection({ snapshot_id: "x" })).toMatchObject({ total: 0, answers: [], errorRows: 0 });
  });
});

describe("extractUrls", () => {
  it("accepts strings and common object shapes, drops non-http and duplicates", () => {
    const urls = extractUrls(
      ["https://a.com/1", "javascript:alert(1)", "not a url"],
      [{ url: "https://b.com" }, { link: "https://a.com/1" }, { href: "http://c.org/x" }],
    );
    expect(urls).toEqual(["https://a.com/1", "https://b.com/", "http://c.org/x"]);
  });
});

describe("mentions", () => {
  it("matches whole words case-insensitively", () => {
    expect(mentions("We recommend ACME for teams.", "Acme")).toBe(true);
    expect(mentions("Acmeville is a town.", "Acme")).toBe(false);
  });

  it("handles names with punctuation", () => {
    expect(mentions("Try monday.com or Asana.", "monday.com")).toBe(true);
    expect(mentions("Use C++ for speed.", "C++")).toBe(true);
  });

  it("ignores terms that are too short to be meaningful", () => {
    expect(mentions("a b c", "a")).toBe(false);
  });
});

describe("domains", () => {
  it("normalizes hosts and matches subdomains", () => {
    expect(domainOf("https://www.Example.com/path")).toBe("example.com");
    expect(hostMatches("blog.example.com", "example.com")).toBe(true);
    expect(hostMatches("notexample.com", "example.com")).toBe(false);
  });
});

describe("excerptAround", () => {
  it("returns the sentence containing the term", () => {
    const text = "First sentence. Acme is great for small teams. Last one.";
    expect(excerptAround(text, "acme")).toMatch(/^Acme is great for small teams\./);
  });
});
