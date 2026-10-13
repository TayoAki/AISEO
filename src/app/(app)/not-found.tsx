import { ButtonLink, Card } from "@/components/ui";

export default function AppNotFound() {
  return (
    <Card className="mx-auto mt-10 flex max-w-lg flex-col items-start gap-3">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">
        This page doesn&apos;t exist. If you followed a link to a report, it may belong to another account.
      </p>
      <ButtonLink href="/reports">Go to your reports</ButtonLink>
    </Card>
  );
}
