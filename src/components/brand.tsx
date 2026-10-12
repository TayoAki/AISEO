import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        AI
      </span>
      <span>AISEO</span>
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} AISEO</p>
        <p>Directional research from live AI answers. Not search volume or ranking data.</p>
      </div>
    </footer>
  );
}
