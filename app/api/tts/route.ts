import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/audio";
import { ttsRequestSchema } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:tts");

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ttsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    log.info({ languageCode: parsed.data.languageCode, gender: parsed.data.npcGender, speed: parsed.data.speed, textLength: parsed.data.text.length }, "TTS request");
    const start = Date.now();
    const wav = await synthesizeSpeech(
      parsed.data.text,
      parsed.data.languageCode,
      parsed.data.npcGender,
      parsed.data.speed,
    );
    log.info({ durationMs: Date.now() - start, responseBytes: wav.byteLength }, "TTS complete");
    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    log.error({ err }, "TTS synthesis failed");
    return NextResponse.json(
      { error: "TTS synthesis failed" },
      { status: 502 },
    );
  }
}
