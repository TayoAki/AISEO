import Link from "next/link";

import { Logo, SiteFooter } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
            <Link href="/pricing" className="rounded-md px-3 py-2 hover:bg-muted">
              Pricing
            </Link>
            <Link href="/sign-in" className="rounded-md px-3 py-2 hover:bg-muted">
              Sign in
            </Link>
            <ButtonLink href="/sign-up" size="sm">
              Get started
            </ButtonLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
