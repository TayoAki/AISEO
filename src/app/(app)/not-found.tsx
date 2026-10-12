import { ButtonLink, Card } from "@/components/ui";

export default function AppNotFound() {
  return (
    <Card className="mx-auto mt-10 flex max-w-lg flex-col items-start gap-3">
      <h1 className="text-lg font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">This report doesn&apos;t exist, or it belongs to another account.</p>
      <ButtonLink href="/reports">Go to your reports</ButtonLink>
    </Card>
  );
}
