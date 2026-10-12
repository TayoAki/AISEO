"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/keywords", label: "Keywords" },
  { href: "/visibility", label: "AI visibility" },
  { href: "/reports", label: "History" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 text-sm lg:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 hover:bg-muted",
            isActive(pathname, link.href) ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      className={cn("rounded-md px-3 py-2 text-sm hover:bg-muted disabled:opacity-50", className)}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        // Full reload (not router.push) so no cached signed-in pages survive.
        window.location.replace("/sign-in");
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

/** Small-screen menu: a native <details> disclosure that closes on navigation. */
export function MobileNav({ email }: { email: string }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  return (
    <details ref={details} className="relative lg:hidden">
      <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-border bg-card p-2 shadow-lg">
        <p className="truncate px-3 py-2 text-xs text-muted-foreground">{email}</p>
        <nav aria-label="Main" className="flex flex-col text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={cn("rounded-md px-3 py-2 hover:bg-muted", isActive(pathname, link.href) && "bg-muted font-medium")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <SignOutButton className="mt-1 w-full text-left" />
      </div>
    </details>
  );
}
