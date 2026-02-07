import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/gradium";

export async function POST(request: Request) {
  const body = await request.json();
  const text = body?.text;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  try {
    const wav = await synthesizeSpeech(text, body?.languageCode, body?.npcGender);
    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: "TTS synthesis failed" },
      { status: 502 },
    );
  }
}
