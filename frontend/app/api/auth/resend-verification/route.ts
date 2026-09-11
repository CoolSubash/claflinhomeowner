import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  // The backend always returns 204 regardless of whether the email is
  // registered (see docs/authentication.md) - this proxy passes that
  // through as-is rather than adding its own logic.
  const { status, data } = await callBackend("/api/v1/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(data, { status });
}
