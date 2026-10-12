"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { authClient, captchaHeaders } from "@/lib/auth-client";
import { Turnstile } from "@/components/turnstile";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export function ForgotPasswordForm({ siteKey }: { siteKey: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!token) return setError("Please complete the security check.");
    setPending(true);
    setError(null);
    const { error: requestError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
      fetchOptions: { headers: captchaHeaders(token) },
    });
    setPending(false);
    if (requestError && requestError.status === 429) {
      setError("Too many attempts. Please wait a few minutes and try again.");
      setWidgetKey((k) => k + 1);
      return;
    }
    // Same message whether or not the account exists.
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If an account exists for that email, we sent a link to reset your password. It expires in 1 hour.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Turnstile key={widgetKey} siteKey={siteKey} action="reset" onToken={setToken} />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  // Better Auth redirects here with ?token=... for a valid link, ?error=INVALID_TOKEN otherwise.
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is invalid or has expired.");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    if (!token) return;
    setPending(true);
    setError(null);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (resetError) return setError("This reset link is invalid or has expired. Request a new one.");
    setDone(true);
  }

  if (done) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">You&apos;ve been signed out everywhere for safety.</p>
        <Link href="/sign-in" className="mt-4 inline-block text-sm font-medium text-primary">
          Sign in with your new password
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field id="password" label="New password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Field id="confirm" label="Confirm new password">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" disabled={pending || !token}>
          {pending ? <Spinner /> : null}
          Update password
        </Button>
      </form>
      {!token ? (
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary">
          Request a new link
        </Link>
      ) : null}
    </Card>
  );
}

export function ResendVerification({ initialEmail }: { initialEmail: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/verify-email" });
    setPending(false);
    setMessage(
      error && error.status === 429
        ? { tone: "danger", text: "Too many requests. Wait a few minutes before trying again." }
        : { tone: "success", text: "If that address needs verifying, a new link is on its way." },
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" defaultValue={initialEmail} autoComplete="email" required />
      </Field>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? <Spinner /> : null}
        Resend verification link
      </Button>
    </form>
  );
}
