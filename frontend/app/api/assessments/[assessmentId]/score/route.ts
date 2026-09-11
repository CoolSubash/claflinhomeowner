import { NextRequest, NextResponse } from "next/server";

import { callBackend } from "@/lib/backend";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Could not validate credentials" }, { status: 401 });
  }

  const { assessmentId } = await params;
  const { status, data } = await callBackend(`/api/v1/assessments/${assessmentId}/score`, {
    method: "POST",
    headers: { Authorization: authHeader },
  });
  return NextResponse.json(data, { status });
}
