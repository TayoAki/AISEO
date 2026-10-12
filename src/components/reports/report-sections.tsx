import { ButtonLink, Card, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ReportDTO } from "@/server/reports/serialize";

import { scoreTone } from "./meta";

const TONE_TEXT = {
  danger: "text-destructive",
  warning: "text-warning",
  info: "text-primary",
  success: "text-success",
} as const;

export function ScoreCard({
  score,
  label,
  title,
  summary,
  children,
}: {
  score: number;
  label: string;
  title: string;
  summary: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="grid gap-6 md:grid-cols-[12rem_1fr]">
      <div className="flex flex-col items-start gap-1">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={cn("text-5xl font-semibold tabular-nums", TONE_TEXT[scoreTone(score)])}>
          {score}
          <span className="text-lg font-normal text-muted-foreground">/100</span>
        </p>
        <p className="font-medium">{label}</p>
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-6">{summary}</p>
        {children}
      </div>
    </Card>
  );
}

/** Horizontal bar for a value out of `max` (shares use max 100). */
export function Meter({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {value}
          {suffix ?? `/${max}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-4", className)}>
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 marker:text-primary">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Paid sections. The server never sends their content to viewers without
 * insights, so "locked" renders an upgrade prompt rather than hiding data.
 */
export function PaidSection({
  state,
  viewerIsPaid,
  title,
  description,
  children,
}: {
  state: ReportDTO["insights"];
  viewerIsPaid: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  if (state === "included") {
    return (
      <Section title={title} description={description}>
        {children}
      </Section>
    );
  }
  return (
    <Card className="flex flex-col items-start gap-3 border-dashed">
      <CardTitle>{title}</CardTitle>
      {state === "locked" ? (
        <>
          <p className="text-sm text-muted-foreground">
            {description} Available on Pro and Plus, along with monthly report allowances.
          </p>
          <ButtonLink href="/billing" size="sm">
            Upgrade to unlock
          </ButtonLink>
        </>
      ) : viewerIsPaid ? (
        <p className="text-sm text-muted-foreground">
          This report ran on the Free plan, so it doesn&apos;t include this section. New reports on your plan do.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {description} Included in every report you run on Pro or Plus.
          </p>
          <ButtonLink href="/billing" size="sm" variant="secondary">
            See plans
          </ButtonLink>
        </>
      )}
    </Card>
  );
}
