import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { publicConfig } from "@/server/public-config";

export const metadata: Metadata = { title: "Reset your password" };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm siteKey={publicConfig().turnstileSiteKey} />;
}
