import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_SECONDS, refreshCookieOptions } from "@/lib/cookies";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  const { ok, status, data } = await callBackend("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!ok) {
    return NextResponse.json(data, { status });
  }

  // The refresh token never reaches client-side JS: it's set as an
  // httpOnly cookie here and stripped from the JSON body the browser gets.
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
