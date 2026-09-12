import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function POST(request: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
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

  const { partnerId } = await params;
  const { status, data } = await callBackend(`/api/v1/admin/realtor-partners/${partnerId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  return status === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(data, { status });
}
