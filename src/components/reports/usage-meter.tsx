import Link from "next/link";

import { Card, ProgressBar } from "@/components/ui";
import { formatDay } from "@/lib/utils";
import { featureLabel } from "@/server/billing/plans";
import type { FeatureUsage } from "@/server/quota/quota";

/** Allowance for one feature: used, in progress and remaining, plus when it resets. */
export function UsageMeter({ usage, action }: { usage: FeatureUsage; action?: React.ReactNode }) {
  const consumed = usage.used + usage.reserved;
  const percent = usage.quota > 0 ? (consumed / usage.quota) * 100 : 100;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{featureLabel(usage.feature)}</p>
        <p className="text-sm text-muted-foreground">
          <span className="text-lg font-semibold text-foreground">{usage.remaining}</span> of {usage.quota} left
        </p>
      </div>
      <ProgressBar value={percent} label={`${featureLabel(usage.feature)} used`} />
      <p className="text-xs text-muted-foreground">
        {usage.reserved > 0 ? `${usage.reserved} running now. ` : null}
        {usage.resetsAt ? (
          `Resets ${formatDay(usage.resetsAt)}.`
        ) : (
          <>
            Free allowance.{" "}
            <Link href="/billing" className="font-medium text-primary">
              Upgrade for monthly reports
            </Link>
          </>
        )}
      </p>
      {action}
    </Card>
  );
}
