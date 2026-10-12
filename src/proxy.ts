import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const APP_PREFIXES = ["/dashboard", "/keywords", "/visibility", "/reports", "/billing", "/settings"];

/**
 * Fast redirects based on cookie presence only. This is a convenience, not
 * authorization: every page and API route re-checks the session server-side.
 * Signed-in users are sent away from /sign-in by the page itself (after a real
 * session check), because a stale cookie here would cause a redirect loop.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (!hasSessionCookie && APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/keywords/:path*",
    "/visibility/:path*",
    "/reports/:path*",
    "/billing/:path*",
    "/settings/:path*",
  ],
};
