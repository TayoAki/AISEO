"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, ProgressBar, Spinner } from "@/components/ui";
import type { ReportProgressDTO } from "@/server/reports/serialize";

const TERMINAL = new Set(["completed", "failed", "canceled"]);
const POLL_MS = 5000;
const MAX_STREAM_ERRORS = 4;

/**
 * Live progress over server-sent events, falling back to polling if the
 * stream keeps failing. When the report finishes, the server page re-renders
 * with the result.
 */
export function LiveProgress({ initial }: { initial: ReportProgressDTO }) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);
  const reportId = initial.id;

  useEffect(() => {
    let stopped = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let streamErrors = 0;

    const finish = () => {
      if (stopped) return;
      stopped = true;
      source?.close();
      clearTimeout(pollTimer);
      router.refresh();
    };

    const poll = async () => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/reports/${reportId}`, { cache: "no-store" });
        if (response.status === 401) {
          router.push(`/sign-in?next=/reports/${reportId}`);
          return;
        }
        if (response.ok) {
          const body = (await response.json()) as { data: { report: ReportProgressDTO } };
          const { id, status, progress: percent, step, error } = body.data.report;
          setProgress({ id, status, progress: percent, step, error });
          if (TERMINAL.has(status)) return finish();
        }
      } catch {
        // Network blip: try again on the next tick.
      }
      pollTimer = setTimeout(() => void poll(), POLL_MS);
    };

    if (typeof EventSource === "undefined") {
      void poll();
    } else {
      source = new EventSource(`/api/reports/${reportId}/events`);
      source.addEventListener("open", () => {
        streamErrors = 0;
      });
      source.addEventListener("progress", (event) => {
        setProgress(JSON.parse((event as MessageEvent<string>).data) as ReportProgressDTO);
      });
      source.addEventListener("done", finish);
      source.addEventListener("error", () => {
        // EventSource reconnects by itself (e.g. after the server's planned
        // reconnect); only give up on the stream if it keeps failing.
        streamErrors += 1;
        if (source?.readyState === EventSource.CLOSED || streamErrors > MAX_STREAM_ERRORS) {
          source?.close();
          source = null;
          void poll();
        }
      });
    }

    return () => {
      stopped = true;
      source?.close();
      clearTimeout(pollTimer);
    };
  }, [reportId, router]);

  const done = TERMINAL.has(progress.status);

  return (
    <Card aria-live="polite" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {done ? null : <Spinner className="text-primary" />}
        <p className="font-medium">{done ? "Finishing up…" : progress.step}</p>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{progress.progress}%</span>
      </div>
      <ProgressBar value={progress.progress} label="Report progress" />
      <p className="text-sm text-muted-foreground">
        We&apos;re collecting live answers from AI assistants, which usually takes a few minutes. You can leave this
        page: the report keeps running and will be in your history. If it fails, your credit is refunded.
      </p>
    </Card>
  );
}
