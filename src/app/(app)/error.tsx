"use client";

import { useEffect } from "react";

import { Button, Card } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-10 flex max-w-lg flex-col items-start gap-3">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load this page. Your reports and credits are safe.
        {error.digest ? ` Reference: ${error.digest}.` : null}
      </p>
      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
