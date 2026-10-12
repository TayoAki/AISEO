"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { authClient, captchaHeaders } from "@/lib/auth-client";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export function SignInForm({ siteKey, next, notice }: { siteKey: string; next: string; notice?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; unverified?: boolean } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!token) return setError({ message: "Please complete the security check." });

    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
      fetchOptions: { headers: captchaHeaders(token) },
    });
    if (signInError) {
      setPending(false);
      setToken(null);
      setWidgetKey((k) => k + 1);
      if (signInError.status === 403) {
        setError({
          message: "Verify your email to sign in. We just sent you a new verification link.",
          unverified: true,
        });
      } else {
        setError({ message: signInError.message ?? "Email or password is incorrect." });
      }
      return;
    }
    // Full navigation so every server component renders with the new session.
    window.location.assign(next);
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Sign in</h1>
      {notice ? (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field id="password" label="Password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Turnstile key={widgetKey} siteKey={siteKey} action="sign-in" onToken={setToken} />
        {error ? (
          <Alert tone={error.unverified ? "warning" : "danger"}>
            {error.message}{" "}
            {error.unverified ? (
              <Link href="/verify-email" className="font-medium underline">
                Need help?
              </Link>
            ) : null}
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Sign in
        </Button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="font-medium text-primary">
          Create an account
        </Link>
      </div>
    </Card>
  );
}
