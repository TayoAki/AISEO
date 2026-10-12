import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { publicConfig } from "@/server/public-config";
import { getSession } from "@/server/web/session";

export const metadata: Metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const session = await getSession();
  if (session?.user.emailVerified) redirect("/dashboard");
  return <SignUpForm siteKey={publicConfig().turnstileSiteKey} />;
}
