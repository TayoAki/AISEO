import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { publicConfig, safeNextPath } from "@/server/public-config";
import { getSession } from "@/server/web/session";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const session = await getSession();
  if (session?.user.emailVerified) redirect(next);
  return <SignInForm siteKey={publicConfig().turnstileSiteKey} next={next} />;
}
