import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NOINDEX = "noindex, nofollow, noarchive";

export function middleware(request: NextRequest): NextResponse {
  const sessionCookie = getSessionCookie(request);
  if (sessionCookie !== null) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", NOINDEX);

    return response;
  }

  const redirect = NextResponse.redirect(new URL("/login", request.url));
  redirect.headers.set("X-Robots-Tag", NOINDEX);

  return redirect;
}

export const config = {
  // Optimistic cookie check only; the real session + membership check happens in
  // requireOrgContext. Exempt: login, the password-reset pages, invite, no-access,
  // the better-auth routes, the token-guarded internal API, Google routes (own
  // session check), the health probe, the deploy-id probe (non-sensitive, polled by
  // the stale-tab guard even after the session lapses), the public offer-view beacon,
  // the client error reporter (errors can fire before auth resolves), Next internals,
  // the favicon and any static asset (paths containing a dot).
  matcher: [
    "/((?!login|zapomenute-heslo|reset-hesla|invite|no-access|api/auth|api/internal|api/google|api/webhooks|api/health|api/version|api/offer-view|api/client-errors|_next|favicon.ico|.*\\..*).*)",
  ],
};
