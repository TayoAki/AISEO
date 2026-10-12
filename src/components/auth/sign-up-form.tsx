"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { authClient, captchaHeaders } from "@/lib/auth-client";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export function SignUpForm({ siteKey }: { siteKey: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < 10) return setError("Use at least 10 characters for your password.");
    if (!token) return setError("Please complete the security check.");

    setPending(true);
    setError(null);
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/verify-email",
      fetchOptions: { headers: captchaHeaders(token) },
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "We couldn't create your account. Please try again.");
      setToken(null);
      setWidgetKey((k) => k + 1);
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <Card className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to <strong className="text-foreground">{sentTo}</strong>. Open it to activate your
          account and your free reports. The link expires in 24 hours.
        </p>
        <Link href={`/verify-email?email=${encodeURIComponent(sentTo)}`} className="text-sm font-medium text-primary">
          Didn&apos;t get it? Resend the link
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Free plan includes 2 keyword reports and 2 visibility scans.</p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field id="name" label="Name">
          <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} />
        </Field>
        <Field id="email" label="Work email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field id="password" label="Password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Turnstile key={widgetKey} siteKey={siteKey} action="sign-up" onToken={setToken} />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
