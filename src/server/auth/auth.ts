import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { handleStripeEvent } from "../billing/stripe-events";
import { PLANS } from "../billing/plans";
import { getDb } from "../db/client";
import { account, rateLimit, session, subscription, user, verification } from "../db/schema";
import { sendEmail } from "../email/send";
import { resetPasswordEmail, verificationEmail } from "../email/templates";
import { assertProductionConfig, getEnv } from "../env";
import { isDisposableEmail, normalizeEmail } from "./email-policy";

const SIGN_UP_REJECTED = "We couldn't create an account with this email address. Try signing in, or use a different address.";

function createAuth() {
  const env = getEnv();
  assertProductionConfig("web", env);
  const db = getDb();

  // Placeholders keep the plugin's endpoints typed when billing is off locally;
  // the UI hides billing actions unless env.billingEnabled is true.
  const stripeClient = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_billing_disabled");

  return betterAuth({
    appName: "AISEO",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification, subscription, rateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user: account, url }) => {
        await sendEmail(resetPasswordEmail(account.email, account.name, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user: account, url }) => {
        // Every verification link lands on /verify-email, which forwards verified
        // users to the dashboard and explains expired or invalid links.
        const link = new URL(url);
        link.searchParams.set("callbackURL", "/verify-email");
        await sendEmail(verificationEmail(account.email, account.name, link.toString()));
      },
    },
    user: {
      additionalFields: {
        normalizedEmail: { type: "string", required: false, input: false },
      },
    },
    session: {
      // Short cookie cache: fewer session lookups, revocation applies within 5 minutes.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-up/email": { window: 60 * 60, max: 5 },
        "/sign-in/email": { window: 60, max: 10 },
        "/request-password-reset": { window: 60 * 60, max: 5 },
        "/send-verification-email": { window: 10 * 60, max: 3 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [env.TRUSTED_IP_HEADER] },
      useSecureCookies: env.NODE_ENV === "production",
    },
    databaseHooks: {
      user: {
        create: {
          before: async (data) => {
            const email = String(data.email ?? "");
            if (await isDisposableEmail(email)) {
              throw new APIError("BAD_REQUEST", { message: "Please use a permanent email address." });
            }
            const normalizedEmail = normalizeEmail(email);
            const [alias] = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.normalizedEmail, normalizedEmail))
              .limit(1);
            if (alias) throw new APIError("BAD_REQUEST", { message: SIGN_UP_REJECTED });
            return { data: { ...data, normalizedEmail } };
          },
        },
      },
    },
    plugins: [
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: env.TURNSTILE_SECRET_KEY,
        endpoints: ["/sign-up/email", "/sign-in/email", "/request-password-reset"],
      }),
      stripe({
        stripeClient,
        stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? "whsec_billing_disabled",
        createCustomerOnSignUp: false,
        onEvent: handleStripeEvent,
        subscription: {
          enabled: true,
          requireEmailVerification: true,
          authorizeReference: async ({ user: account, referenceId }) => referenceId === account.id,
          plans: [
            {
              name: "pro",
              priceId: env.STRIPE_PRICE_PRO_MONTHLY,
              annualDiscountPriceId: env.STRIPE_PRICE_PRO_ANNUAL,
              limits: PLANS.pro.limits,
            },
            {
              name: "plus",
              priceId: env.STRIPE_PRICE_PLUS_MONTHLY,
              annualDiscountPriceId: env.STRIPE_PRICE_PLUS_ANNUAL,
              limits: PLANS.plus.limits,
            },
          ],
        },
      }),
      // Must be last: lets server actions set auth cookies.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __aiseoAuth?: Auth };

/** Lazily constructed so builds and tests don't need auth secrets. */
export function getAuth(): Auth {
  globalForAuth.__aiseoAuth ??= createAuth();
  return globalForAuth.__aiseoAuth;
}
