import { NextResponse, type NextRequest } from "next/server";

import { REFRESH_TOKEN_COOKIE } from "@/lib/cookies";

// Presence-only check at the edge, purely to avoid a flash of protected
// content before the client mounts. It is not the real authorization
// check - the refresh_token cookie could be stale or already revoked, so
// app/(app)/layout.tsx still re-verifies via /api/auth/me before
// rendering anything.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(REFRESH_TOKEN_COOKIE);

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
