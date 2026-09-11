import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
  }

  const { sessionId } = await params;
  const { status, data } = await callBackend(`/api/v1/chat/sessions/${sessionId}`, {
    headers: { Authorization: authHeader },
  });
  return NextResponse.json(data, { status });
}
