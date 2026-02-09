import { NextResponse } from "next/server";
import { createLogger } from "@/core/logger";
import { getPoliceIntroMessage } from "@/core/npc";
import type { NpcGender } from "@/core/types";
import { getPoliceAudio } from "@/infra/storage";
import { synthesizeSpeech } from "@/infra/tts";

const log = createLogger("api:police-audio");

const VALID_TYPES = new Set(["policeman", "policewoman"]);
const VALID_LANGS = new Set(["en", "fr", "de", "es", "pt"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const lang = searchParams.get("lang");

  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 },
    );
  }
  if (!lang || !VALID_LANGS.has(lang)) {
    return NextResponse.json(
      { error: "Invalid lang parameter" },
      { status: 400 },
    );
  }

  const key = `${type}_${lang}`;
  const cached = await getPoliceAudio(key);

  if (cached) {
    log.info({ key }, "police audio cache hit");
    const buffer = Buffer.from(cached, "base64");
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Fallback: generate on-demand via Gradium TTS
  log.info({ key }, "police audio cache miss, generating via TTS");
  try {
    const text = getPoliceIntroMessage(lang);
    const gender: NpcGender = type === "policeman" ? "masculine" : "feminine";
    const wav = await synthesizeSpeech(text, lang, gender);
    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    log.error({ err }, "police audio TTS fallback failed");
    return NextResponse.json(
      { error: "TTS synthesis failed" },
      { status: 502 },
    );
  }
}
