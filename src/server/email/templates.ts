import type { EmailMessage } from "./send";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, body: string, action: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f7f6;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#13201a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 4px;font-weight:700;color:#0f7a4f">AISEO</p>
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
${body}
<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#0f7a4f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:600">${escapeHtml(action.label)}</a></p>
<p style="margin:0;font-size:12px;color:#5b6b63">If the button doesn't work, paste this link into your browser:<br>${escapeHtml(action.url)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function verificationEmail(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "Verify your email for AISEO",
    html: layout(
      "Confirm your email address",
      `<p style="margin:0">Hi ${escapeHtml(name)}, confirm your email to activate your account and your free reports. The link expires in 24 hours.</p>`,
      { label: "Verify email", url },
    ),
    text: `Hi ${name},\n\nConfirm your email to activate your AISEO account and your free reports:\n${url}\n\nThe link expires in 24 hours.`,
  };
}

export function resetPasswordEmail(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset your AISEO password",
    html: layout(
      "Reset your password",
      `<p style="margin:0">Hi ${escapeHtml(name)}, someone asked to reset your password. If it wasn't you, ignore this email. The link expires in 1 hour.</p>`,
      { label: "Choose a new password", url },
    ),
    text: `Hi ${name},\n\nReset your AISEO password:\n${url}\n\nIf you didn't ask for this, ignore this email. The link expires in 1 hour.`,
  };
}

export function paymentFailedEmail(to: string, name: string, billingUrl: string): EmailMessage {
  return {
    to,
    subject: "Your AISEO payment didn't go through",
    html: layout(
      "We couldn't charge your card",
      `<p style="margin:0">Hi ${escapeHtml(name)}, your latest payment failed. Stripe will retry automatically; update your payment method to keep your plan's allowance.</p>`,
      { label: "Update payment method", url: billingUrl },
    ),
    text: `Hi ${name},\n\nYour latest AISEO payment failed. Stripe will retry automatically; update your payment method to keep your plan:\n${billingUrl}`,
  };
}
