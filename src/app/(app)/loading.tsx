import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex items-center gap-3 py-16 text-sm text-muted-foreground" role="status">
      <Spinner />
      Loading…
    </div>
  );
}
