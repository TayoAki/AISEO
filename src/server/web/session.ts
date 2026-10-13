import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { isAdmin } from "../admin/admins";
import { getAuth } from "../auth/auth";
import { getEntitlements, type Entitlements } from "../billing/entitlements";
import { getDb } from "../db/client";
import { getUsageSummary, type FeatureUsage } from "../quota/quota";
import type { Feature } from "../billing/plans";

export const getSession = cache(async () => {
  return getAuth().api.getSession({ headers: await headers() });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

/** For pages: redirects to sign-in (or verification) instead of returning null. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.user.emailVerified) redirect("/verify-email");
  return session.user;
}

/** For admin pages: everyone else gets a 404, so the page's existence isn't revealed. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}

export type Viewer = {
  user: SessionUser;
  entitlements: Entitlements;
  usage: Record<Feature, FeatureUsage>;
};

/** Everything a signed-in page needs about the current user, once per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const db = getDb();
  const entitlements = await getEntitlements(db, user.id);
  const usage = await getUsageSummary(db, user.id, entitlements, new Date());
  return { user, entitlements, usage };
});
