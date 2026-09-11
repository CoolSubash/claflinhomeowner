import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function GET(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
  }

  const { assessmentId } = await params;
  const { status, data } = await callBackend(`/api/v1/assessments/${assessmentId}`, {
    headers: { Authorization: authHeader },
  });
  return NextResponse.json(data, { status });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
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

  const { assessmentId } = await params;
  const { status, data } = await callBackend(`/api/v1/assessments/${assessmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  return NextResponse.json(data, { status });
}
