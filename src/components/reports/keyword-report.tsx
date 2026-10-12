import { Badge } from "@/components/ui";
import { plural } from "@/lib/utils";
import type { KeywordResult } from "@/server/reports/results";
import type { ReportDTO } from "@/server/reports/serialize";

import { BulletList, Meter, PaidSection, ScoreCard, Section } from "./report-sections";

const BREAKDOWN: Array<{ key: keyof KeywordResult["scoreBreakdown"]; label: string; max: number }> = [
  { key: "demand", label: "Demand", max: 25 },
  { key: "questionDiversity", label: "Question diversity", max: 20 },
  { key: "contentDepth", label: "Content depth opportunity", max: 20 },
  { key: "competition", label: "Competitive opening", max: 20 },
  { key: "sourceConfidence", label: "Evidence strength", max: 15 },
];

const STRENGTH_TONE = {
  Leading: "danger",
  Established: "warning",
  Emerging: "info",
  "Not mentioned": "neutral",
} as const;

const OPPORTUNITY_TONE = { High: "success", Medium: "info", Low: "neutral" } as const;

export function KeywordReport({ result, insights }: { result: KeywordResult; insights: ReportDTO["insights"] }) {
  const { coverage } = result;

  return (
    <div className="flex flex-col gap-6">
      <ScoreCard score={result.score} label={result.scoreLabel} title="Opportunity score" summary={result.summary}>
        <div className="grid gap-3 sm:grid-cols-2">
          {BREAKDOWN.map((item) => (
            <Meter key={item.key} label={item.label} value={result.scoreBreakdown[item.key]} max={item.max} />
          ))}
        </div>
      </ScoreCard>

      <p className="text-xs text-muted-foreground">
        Based on {plural(coverage.answers, "AI answer")} citing {plural(coverage.sources, "source")} across{" "}
        {plural(coverage.uniqueDomains, "domain")}
        {coverage.errorRows > 0
          ? ` (${plural(coverage.errorRows, "answer")} couldn't be collected and ${coverage.errorRows === 1 ? "was" : "were"} excluded)`
          : ""}
        . Scores are directional, not search volume.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Most cited domains" description="Where AI answers get their information for this keyword.">
          {result.topDomains.length === 0 ? (
            <p className="text-sm text-muted-foreground">The answers didn&apos;t cite any sources.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Domain</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 text-right font-medium">Citations</th>
                    <th className="pb-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.topDomains.map((row) => (
                    <tr key={row.domain}>
                      <td className="py-2 pr-3 font-medium">{row.domain}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.category}</td>
                      <td className="py-2 text-right tabular-nums">{row.sources}</td>
                      <td className="py-2 text-right tabular-nums">{row.share}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Source mix" description="The kinds of sites AI answers rely on.">
          {result.sourceMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources to classify.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {result.sourceMix.map((row) => (
                <Meter key={row.category} label={row.category} value={row.share} max={100} suffix="%" />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Competing brands" description="Brands the answers mention, counted directly from the text.">
        {result.competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brands stood out in these answers.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.competitors.map((competitor, index) => (
              <li key={index} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{competitor.name}</p>
                  <Badge tone={STRENGTH_TONE[competitor.strength]}>{competitor.strength}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {competitor.domain ?? "No website identified"} · {plural(competitor.mentions, "mention")} ·{" "}
                  {competitor.share}% share
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Prompts to target" description="Questions people ask AI assistants about this topic.">
          <ul className="flex flex-col divide-y divide-border">
            {result.promptIdeas.map((idea, index) => (
              <li key={index} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm">{idea.prompt}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{idea.intent}</p>
                </div>
                <Badge tone={OPPORTUNITY_TONE[idea.opportunity]}>{idea.opportunity}</Badge>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Related keyword clusters" description="Group these into pages or sections.">
          <div className="flex flex-col gap-4">
            {result.keywordClusters.map((cluster, index) => (
              <div key={index}>
                <p className="text-sm font-medium">{cluster.cluster}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {cluster.keywords.map((keyword, index) => (
                    <li key={index}>
                      <Badge title={`Relevance ${keyword.relevance}%`}>{keyword.keyword}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <PaidSection
        state={insights}
        title="AI insights and content plan"
        description="Key findings, content gaps, quick wins and a content plan built from this evidence."
      >
        {result.insights ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Key findings</p>
              <BulletList items={result.insights.keyFindings} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Content gaps</p>
              <BulletList items={result.insights.contentGaps} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Quick wins</p>
              <BulletList items={result.insights.quickWins} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Content plan</p>
              <ul className="flex flex-col gap-3">
                {result.insights.contentPlan.map((item, index) => (
                  <li key={index} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.format} · {item.angle}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </PaidSection>
    </div>
  );
}
