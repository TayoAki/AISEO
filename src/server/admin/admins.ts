import { getEnv } from "../env";

/**
 * Admins are the verified accounts whose email is listed in ADMIN_EMAILS.
 * There is no admin role in the database, so nobody can grant themselves
 * access through the app.
 */
export function isAdmin(
  user: { email: string; emailVerified: boolean },
  adminEmails: readonly string[] = getEnv().ADMIN_EMAILS,
): boolean {
  return user.emailVerified && adminEmails.includes(user.email.trim().toLowerCase());
}
