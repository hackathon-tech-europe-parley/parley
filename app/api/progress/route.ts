import { NextResponse } from "next/server";
import { progressResponseSchema } from "@/core/types";
import { getSessionId } from "@/infra/session";
import { getProgress } from "@/infra/storage";

export async function GET() {
  const sessionId = await getSessionId();
  if (!sessionId) {
    return NextResponse.json([], { status: 200 });
  }

  const entries = await getProgress(sessionId);
  return NextResponse.json(progressResponseSchema.parse(entries));
}
