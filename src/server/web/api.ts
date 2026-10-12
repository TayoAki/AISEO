import "server-only";

import { NextResponse } from "next/server";

import { getAuth } from "../auth/auth";

/**
 * Consistent JSON envelope for app routes: `{ data }` on success and
 * `{ error: { code, message, fields? } }` on failure.
 */
export function ok<T>(data: T, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
}

export function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[] | undefined>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Returns the verified user for an API request, or an error response. */
export async function requireApiUser(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return { error: fail(401, "UNAUTHENTICATED", "Sign in to continue.") } as const;
  if (!session.user.emailVerified) {
    return { error: fail(403, "EMAIL_NOT_VERIFIED", "Verify your email address to continue.") } as const;
  }
  return { user: session.user } as const;
}

export function clientIp(request: Request, header: string): string | null {
  const value = request.headers.get(header);
  return value ? value.split(",")[0]!.trim() : null;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
