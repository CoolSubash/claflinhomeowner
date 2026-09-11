import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
  }

  const search = request.nextUrl.search;
  const { status, data } = await callBackend(`/api/v1/readiness-results${search}`, {
    headers: { Authorization: authHeader },
  });
  return NextResponse.json(data, { status });
}
