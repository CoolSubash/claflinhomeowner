import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_SECONDS, refreshCookieOptions } from "@/lib/cookies";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { ok, status, data } = await callBackend("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!ok) {
    const response = NextResponse.json(data, { status });
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  // Refresh rotates the token - the old cookie value is replaced with the
  // new one, matching the backend's single-use rotation contract.
  const response = NextResponse.json({
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, data.refresh_token as string, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
  return response;
}
