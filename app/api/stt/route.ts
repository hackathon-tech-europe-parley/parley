import { NextResponse } from "next/server";
import { createLogger } from "@/core/logger";
import { sttRequestSchema } from "@/core/types";
import { transcribeAudio } from "@/infra/stt";

const log = createLogger("api:stt");

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sttRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const pcmBuffer = Buffer.from(parsed.data.audio, "base64");
  const languageCode = parsed.data.languageCode;

  try {
    log.info({ languageCode, audioBytes: pcmBuffer.length }, "STT request");
    const start = Date.now();
    const text = await transcribeAudio(pcmBuffer, languageCode);
    log.info(
      { durationMs: Date.now() - start, transcriptLength: text.length },
      "STT complete",
    );
    return NextResponse.json({ text });
  } catch (err) {
    log.error({ err }, "STT transcription failed");
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 },
    );
  }
}
