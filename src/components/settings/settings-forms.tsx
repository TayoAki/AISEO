"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, Button, Card, CardTitle, Field, Input, Spinner } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

type Message = { tone: "success" | "danger"; text: string } | null;

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (nextName.length < 2 || nextName.length > 80) {
      setMessage({ tone: "danger", text: "Use between 2 and 80 characters." });
      return;
    }
    setPending(true);
    const { error } = await authClient.updateUser({ name: nextName });
    setPending(false);
    setMessage(error ? { tone: "danger", text: error.message ?? "Couldn't save." } : { tone: "success", text: "Saved." });
    if (!error) router.refresh();
  }

  return (
    <Card>
      <CardTitle>Profile</CardTitle>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        <Field id="name" label="Name">
          <Input id="name" name="name" defaultValue={name} autoComplete="name" maxLength={80} required />
        </Field>
        <Field id="email" label="Email" hint="Your sign-in email can't be changed yet. Contact support if you need to.">
          <Input id="email" value={email} readOnly disabled />
        </Field>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword.length < 10) {
      setMessage({ tone: "danger", text: "Use at least 10 characters for your new password." });
      return;
    }
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setPending(false);
    if (error) {
      setMessage({ tone: "danger", text: error.message ?? "Couldn't change your password." });
      return;
    }
    formElement.reset();
    setMessage({ tone: "success", text: "Password changed. Other devices have been signed out." });
  }

  return (
    <Card>
      <CardTitle>Password</CardTitle>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        <Field id="currentPassword" label="Current password">
          <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field id="newPassword" label="New password" hint="At least 10 characters.">
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner /> : null}
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SessionsCard() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  return (
    <Card className="flex flex-col items-start gap-3">
      <CardTitle>Devices</CardTitle>
      <p className="text-sm text-muted-foreground">Signed in somewhere you don&apos;t recognise? Sign out everywhere else.</p>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const { error } = await authClient.revokeOtherSessions();
          setPending(false);
          setMessage(
            error
              ? { tone: "danger", text: error.message ?? "Couldn't sign out other devices." }
              : { tone: "success", text: "Other devices have been signed out." },
          );
        }}
      >
        {pending ? <Spinner /> : null}
        Sign out other devices
      </Button>
    </Card>
  );
}
