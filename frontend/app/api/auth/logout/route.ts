import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";
import { REFRESH_TOKEN_COOKIE } from "@/lib/cookies";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    await callBackend("/api/v1/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  // Always succeeds and always clears the cookie, whether or not a token
  // was present - mirrors the backend's own idempotent logout contract.
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
