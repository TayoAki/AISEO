import { Badge } from "@/components/ui";
import { plural } from "@/lib/utils";
import type { VisibilityPlatform, VisibilityResult } from "@/server/reports/results";
import type { ReportDTO } from "@/server/reports/serialize";

import { scoreTone } from "./meta";
import { PaidSection, ScoreCard, Section } from "./report-sections";

const PLATFORM_NAME: Record<VisibilityPlatform, string> = { chatgpt: "ChatGPT", gemini: "Gemini" };
const PRIORITY_TONE = { High: "danger", Medium: "warning", Low: "neutral" } as const;

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={on ? "text-success" : "text-muted-foreground"}>
      {on ? "✓" : "✗"} <span className="sr-only">{on ? label : `not ${label}`}</span>
    </span>
  );
}

export function VisibilityReport({
  result,
  insights,
  viewerIsPaid,
  brand,
}: {
  result: VisibilityResult;
  insights: ReportDTO["insights"];
  viewerIsPaid: boolean;
  brand: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ScoreCard score={result.score} label={result.scoreLabel} title="AI visibility score" summary={result.summary}>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.platforms.map((platform) => (
            <div key={platform.platform} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{PLATFORM_NAME[platform.platform]}</p>
                <Badge tone={scoreTone(platform.score)}>{platform.score}/100</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Mentioned in {platform.mentions} of {plural(platform.answered, "answer")} · cited{" "}
                {plural(platform.citations, "time")}
                {platform.failed > 0 ? ` · ${plural(platform.failed, "answer")} unavailable` : ""}
              </p>
            </div>
          ))}
        </div>
      </ScoreCard>

      <Section
        title="Prompt by prompt"
        description={`Neutral buyer questions that don't name ${brand}. Mentioned means the answer names you; cited means it links to your site.`}
      >
        <ul className="flex flex-col divide-y divide-border">
          {result.prompts.map((prompt, index) => (
            <li key={index} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium">{prompt.prompt}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {prompt.results.map((answer) => (
                  <div key={answer.platform} className="rounded-lg bg-muted/60 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium">{PLATFORM_NAME[answer.platform]}</span>
                      {answer.answered ? (
                        <>
                          <span>
                            <Check on={answer.mentioned} label="mentioned" /> Mentioned
                          </span>
                          <span>
                            <Check on={answer.cited} label="cited" /> Cited
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No answer collected (excluded from the score)</span>
                      )}
                    </div>
                    {answer.excerpt ? (
                      <blockquote className="mt-2 border-l-2 border-primary pl-3 text-xs text-muted-foreground">
                        {answer.excerpt}
                      </blockquote>
                    ) : null}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Who gets recommended instead" description="Other brands named in the same answers.">
        {result.competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other brands were named.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.competitors.map((competitor, index) => (
              <li key={index} className="rounded-lg border border-border p-3">
                <p className="font-medium">{competitor.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {competitor.domain ?? "No website identified"} · {plural(competitor.mentions, "mention")} on{" "}
                  {competitor.platforms.map((p) => PLATFORM_NAME[p]).join(" and ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <PaidSection
        state={insights}
        viewerIsPaid={viewerIsPaid}
        title="Recommendations"
        description="Prioritised actions to get mentioned and cited more often."
      >
        {result.recommendations ? (
          <ul className="flex flex-col gap-3">
            {result.recommendations.map((item, index) => (
              <li key={index} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <Badge tone={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </PaidSection>
    </div>
  );
}
