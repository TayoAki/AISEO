import { AppNav, MobileNav, SignOutButton } from "@/components/app/app-nav";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui";
import { isAdmin } from "@/server/admin/admins";
import { PLANS } from "@/server/billing/plans";
import { getViewer } from "@/server/web/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, entitlements } = await getViewer();
  const admin = isAdmin(user);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-6">
            <Logo href="/dashboard" />
            <AppNav isAdmin={admin} />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={entitlements.isPaid ? "info" : "neutral"}>{PLANS[entitlements.plan].name} plan</Badge>
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground lg:inline">{user.email}</span>
            <SignOutButton className="hidden lg:inline-flex" />
            <MobileNav email={user.email} isAdmin={admin} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
