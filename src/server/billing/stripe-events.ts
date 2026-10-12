import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { getDb } from "../db/client";
import { user, webhookEvent } from "../db/schema";
import { sendEmail } from "../email/send";
import { paymentFailedEmail } from "../email/templates";
import { getEnv } from "../env";

/**
 * Extra Stripe events the app handles on top of the Better Auth Stripe
 * plugin (which keeps the subscription table in sync). Stripe may deliver an
 * event more than once and in any order, so each event is recorded first and
 * skipped if it was already handled.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  const inserted = await db
    .insert(webhookEvent)
    .values({ id: event.id, provider: "stripe", type: event.type })
    .onConflictDoNothing()
    .returning({ id: webhookEvent.id });
  if (inserted.length === 0) return;

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const [account] = await db
      .select({ email: user.email, name: user.name })
      .from(user)
      .where(eq(user.stripeCustomerId, customerId))
      .limit(1);
    if (!account) {
      console.warn("[stripe] payment failed for unknown customer", { eventId: event.id, customerId });
      return;
    }
    console.warn("[stripe] invoice payment failed", { eventId: event.id, customerId });
    await sendEmail(paymentFailedEmail(account.email, account.name, `${getEnv().APP_URL}/billing`));
  }
}
