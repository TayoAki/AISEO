import { getEnv } from "../env";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/**
 * Sends transactional email through Resend. Without RESEND_API_KEY (local
 * development and tests) the message is logged instead so verification and
 * reset links can be opened from the console. Production requires the key.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    console.info(`[email] (not sent; RESEND_API_KEY unset) to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }

  const fail = (detail: string): never => {
    // Callers such as Better Auth may swallow this error; make sure it's visible.
    console.error("[email] send failed", { subject: message.subject, toDomain: message.to.split("@")[1], detail });
    throw new Error(`Email could not be sent: ${detail}`);
  };

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return fail(`request failed: ${(error as Error).message}`);
  }

  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 300);
    fail(`provider rejected the message (${response.status}): ${body}`);
  }
}
