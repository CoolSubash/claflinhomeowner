import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
  }

  const { status, data } = await callBackend("/api/v1/admin/realtor-partners", {
    headers: { Authorization: authHeader },
  });
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  const { status, data } = await callBackend("/api/v1/admin/realtor-partners", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
