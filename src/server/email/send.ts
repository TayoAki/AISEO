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

  const response = await fetch("https://api.resend.com/emails", {
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

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`Email provider rejected the message (${response.status}): ${body}`);
  }
}
