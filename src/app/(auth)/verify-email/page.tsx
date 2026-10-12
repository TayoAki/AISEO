import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ResendVerification } from "@/components/auth/password-forms";
import { Alert, Card } from "@/components/ui";
import { getSession } from "@/server/web/session";

export const metadata: Metadata = { title: "Verify your email" };
export const dynamic = "force-dynamic";

// Better Auth appends ?error=<code> when a verification link can't be used.
const LINK_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: "That verification link has expired. Send yourself a new one below.",
  INVALID_TOKEN: "That verification link is invalid or was already used. Send yourself a new one below.",
  USER_NOT_FOUND: "We couldn't find an account for that link. Try signing up again.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  // Verification links land here: a verified, signed-in user goes straight in.
  if (session?.user.emailVerified) redirect("/dashboard");

  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : null;
  const email = typeof params.email === "string" ? params.email : (session?.user.email ?? "");

  return (
    <Card>
      <h1 className="text-xl font-semibold">Verify your email</h1>
      <div className="mt-4">
        {errorCode ? (
          <Alert tone="danger">{LINK_ERRORS[errorCode] ?? "That link didn't work. Send yourself a new one below."}</Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            We sent you a verification link. Open it on this device to activate your account. Check your spam folder
            if you can&apos;t find it.
          </p>
        )}
      </div>
      <ResendVerification initialEmail={email} />
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
