import { describe, expect, it } from "vitest";

import { isDisposableEmail, normalizeEmail } from "@/server/auth/email-policy";
import { freeEntitlements, type Entitlements } from "@/server/billing/entitlements";
import { collectionWebhookUrl, verifyCollectionToken } from "@/server/pipeline/webhook-token";
import { safeNextPath } from "@/server/public-config";
import type { ReportRow } from "@/server/reports/queries";
import { serializeReport } from "@/server/reports/serialize";

describe("normalizeEmail", () => {
  it("collapses Gmail dots, plus tags and googlemail", () => {
    expect(normalizeEmail("J.Ane.Doe+promo@GMAIL.com")).toBe("janedoe@gmail.com");
    expect(normalizeEmail("janedoe@googlemail.com")).toBe("janedoe@gmail.com");
  });

  it("strips plus tags but keeps dots elsewhere", () => {
    expect(normalizeEmail("first.last+x@company.io")).toBe("first.last@company.io");
  });
});

describe("isDisposableEmail", () => {
  it("flags known disposable domains, including wildcard subdomains", async () => {
    expect(await isDisposableEmail("someone@mailinator.com")).toBe(true);
    expect(await isDisposableEmail("someone@inbox.10mail.org")).toBe(true);
    expect(await isDisposableEmail("someone@gmail.com")).toBe(false);
  });
});

describe("webhook tokens", () => {
  const secret = "test-secret-test-secret-test-secret-123";
  const id = "6f1c2b3a-1111-4222-8333-944455556666";

  it("round-trips and rejects tampering", () => {
    const url = new URL(collectionWebhookUrl("https://app.example", id, secret));
    const token = url.searchParams.get("token")!;
    expect(url.pathname).toBe("/api/webhooks/brightdata");
    expect(verifyCollectionToken(id, token, secret)).toBe(true);
    expect(verifyCollectionToken(id, `${token}x`, secret)).toBe(false);
    expect(verifyCollectionToken("6f1c2b3a-1111-4222-8333-944455556667", token, secret)).toBe(false);
  });
});

describe("serializeReport (server-side paywall)", () => {
  const keywordResult = {
    version: 1,
    score: 70,
    scoreLabel: "Strong",
    scoreBreakdown: { demand: 20, questionDiversity: 15, contentDepth: 15, competition: 10, sourceConfidence: 10 },
    summary: "s",
    coverage: { answers: 3, errorRows: 0, sources: 5, uniqueDomains: 4 },
    topDomains: [],
    sourceMix: [],
    competitors: [],
    promptIdeas: [],
    keywordClusters: [],
    insights: { keyFindings: ["paid"], contentGaps: [], quickWins: [], contentPlan: [] },
  };
  const row = (overrides: Partial<ReportRow> = {}): ReportRow => ({
    id: "6f1c2b3a-1111-4222-8333-944455556666",
    userId: "u1",
    type: "keyword",
    status: "completed",
    progress: 100,
    step: "Report ready",
    title: "crm software",
    input: { type: "keyword", keyword: "crm software", country: "US" },
    tier: "pro",
    prompts: null,
    result: keywordResult,
    resultVersion: 1,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    completedAt: new Date("2026-10-01T00:05:00Z"),
    ...overrides,
  });
  const pro: Entitlements = { plan: "pro", isPaid: true, insights: true, subscription: null };

  it("never sends paid sections to a free viewer", () => {
    const dto = serializeReport(row(), freeEntitlements());
    expect(dto.insights).toBe("locked");
    expect(dto.keyword).not.toHaveProperty("insights");
    expect(JSON.stringify(dto)).not.toContain("paid");
  });

  it("includes paid sections for a paid viewer", () => {
    const dto = serializeReport(row(), pro);
    expect(dto.insights).toBe("included");
    expect(dto.keyword?.insights?.keyFindings).toEqual(["paid"]);
  });

  it("explains when a report was generated on the free plan", () => {
    const { insights: _omit, ...freeResult } = keywordResult;
    expect(serializeReport(row({ tier: "free", result: freeResult }), pro).insights).toBe("notGenerated");
    // Upgrading can't unlock sections that were never generated, so free viewers aren't told it would.
    expect(serializeReport(row({ tier: "free", result: freeResult }), freeEntitlements()).insights).toBe("notGenerated");
  });

  it("only exposes the safe error message for failed reports", () => {
    const dto = serializeReport(
      row({ status: "failed", result: null, errorCode: "TIMED_OUT", errorMessage: "Took too long." }),
      pro,
    );
    expect(dto.error).toEqual({ code: "TIMED_OUT", message: "Took too long." });
    expect(dto.keyword).toBeNull();
  });
});

describe("safeNextPath (open redirect protection)", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/reports?type=keyword")).toBe("/reports?type=keyword");
    expect(safeNextPath(["/billing", "/other"])).toBe("/billing");
  });

  it.each([
    ["missing", undefined],
    ["absolute URL", "https://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["tab trick", "/\t/evil.example"],
    ["newline trick", "/\n/evil.example"],
    ["no leading slash", "evil.example"],
  ])("rejects %s", (_label, value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
});
