import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { getDb } from "../db/client";
import { subscription, user, webhookEvent } from "../db/schema";
import { sendEmail } from "../email/send";
import { paymentFailedEmail } from "../email/templates";
import { getEnv } from "../env";
import type { PaidPlanId } from "./plans";

/**
 * Extra Stripe handling on top of the Better Auth Stripe plugin, which keeps
 * the subscription table in sync from event payloads. That isn't enough on
 * its own: the plugin applies snapshots in arrival order (Stripe doesn't
 * guarantee order, and retries arrive late) and swallows its own errors. So
 * after every subscription event the row is re-synced from Stripe's current
 * state, which is idempotent and converges no matter the order.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const subscriptionId = subscriptionIdOf(event);
  if (subscriptionId) await syncSubscription(subscriptionId, event);

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    await once(event, async () => {
      const [account] = await getDb()
        .select({ email: user.email, name: user.name })
        .from(user)
        .where(eq(user.stripeCustomerId, customerId))
        .limit(1);
      if (!account) {
        console.warn("[stripe] payment failed for unknown customer", { eventId: event.id });
        return;
      }
      console.warn("[stripe] invoice payment failed", { eventId: event.id });
      await sendEmail(paymentFailedEmail(account.email, account.name, `${getEnv().APP_URL}/billing`));
    });
  }
}

function subscriptionIdOf(event: Stripe.Event): string | null {
  if (event.type.startsWith("customer.subscription.")) {
    return (event.data.object as Stripe.Subscription).id;
  }
  if (event.type === "checkout.session.completed") {
    const ref = event.data.object.subscription;
    return typeof ref === "string" ? ref : (ref?.id ?? null);
  }
  return null;
}

/**
 * Runs a side effect once per event. The event is recorded in the same
 * transaction, so if the side effect throws, the record rolls back and
 * Stripe's retry runs it again. A concurrent duplicate waits on the unique
 * key and then skips.
 */
async function once(event: Stripe.Event, effect: () => Promise<void>): Promise<void> {
  await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(webhookEvent)
      .values({ id: event.id, provider: "stripe", type: event.type })
      .onConflictDoNothing()
      .returning({ id: webhookEvent.id });
    if (inserted.length === 0) return;
    await effect();
  });
}

let stripeClient: Stripe | undefined;

function getStripe(): Stripe {
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

function planForPrice(priceId: string): PaidPlanId | null {
  const env = getEnv();
  if (priceId === env.STRIPE_PRICE_PRO_MONTHLY || priceId === env.STRIPE_PRICE_PRO_ANNUAL) return "pro";
  if (priceId === env.STRIPE_PRICE_PLUS_MONTHLY || priceId === env.STRIPE_PRICE_PLUS_ANNUAL) return "plus";
  return null;
}

const fromUnix = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/** The subscription row fields that mirror Stripe's current state (same mapping as the plugin). */
export function subscriptionFields(live: Stripe.Subscription, planOf: (priceId: string) => PaidPlanId | null) {
  const item = live.items.data[0];
  const plan = item ? planOf(item.price.id) : null;
  return {
    status: live.status,
    cancelAtPeriodEnd: live.cancel_at_period_end,
    cancelAt: fromUnix(live.cancel_at),
    canceledAt: fromUnix(live.canceled_at),
    endedAt: fromUnix(live.ended_at),
    ...(item
      ? {
          periodStart: fromUnix(item.current_period_start),
          periodEnd: fromUnix(item.current_period_end),
          billingInterval: item.price.recurring?.interval ?? null,
        }
      : {}),
    ...(plan ? { plan } : {}),
  };
}

async function syncSubscription(stripeSubscriptionId: string, event: Stripe.Event): Promise<void> {
  // Errors propagate: the plugin then answers 400 and Stripe retries the event.
  const live = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  const updated = await getDb()
    .update(subscription)
    .set(subscriptionFields(live, planForPrice))
    .where(eq(subscription.stripeSubscriptionId, live.id))
    .returning({ id: subscription.id });
  if (updated.length === 0) {
    console.warn("[stripe] no local row for subscription", { eventId: event.id, type: event.type, subscriptionId: live.id });
  }
}
