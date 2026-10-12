import type { Metadata } from "next";

import { PasswordForm, ProfileForm, SessionsCard } from "@/components/settings/settings-forms";
import { PageHeader } from "@/components/ui";
import { getViewer } from "@/server/web/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await getViewer();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Settings" description="Your profile, password and signed-in devices." />
      <ProfileForm name={user.name} email={user.email} />
      <PasswordForm />
      <SessionsCard />
    </div>
  );
}
