import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());
import { POLICE_INTRO_MESSAGES } from "../lib/game/npc-assets";
import { VOICE_MAP } from "../lib/audio/gradium";
import { setPoliceAudio } from "../lib/storage/police-audio";

const POLICE_TYPES = ["policeman", "policewoman"] as const;
const LANGUAGES = Object.keys(POLICE_INTRO_MESSAGES);

// policeman → masculine voice, policewoman → feminine voice
const GENDER_FOR_TYPE = {
  policeman: "masculine",
  policewoman: "feminine",
} as const;

async function generateTTS(text: string, voiceId: string): Promise<ArrayBuffer> {
  const apiKey = process.env.GRADIUM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GRADIUM_API_KEY environment variable");
  }

  const res = await fetch("https://eu.api.gradium.ai/api/post/speech/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      output_format: "wav",
      only_audio: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gradium TTS failed (${res.status}): ${body}`);
  }

  return res.arrayBuffer();
}

async function main() {
  console.log(`Generating police intro audio for ${LANGUAGES.length} languages x ${POLICE_TYPES.length} types...`);

  for (const lang of LANGUAGES) {
    for (const type of POLICE_TYPES) {
      const key = `${type}_${lang}`;
      const text = POLICE_INTRO_MESSAGES[lang];
      const gender = GENDER_FOR_TYPE[type];
      const voiceId = VOICE_MAP[lang]?.[gender] ?? VOICE_MAP["en"][gender];

      console.log(`Generating ${key} (voice: ${voiceId})...`);

      const wav = await generateTTS(text, voiceId);
      const base64 = Buffer.from(wav).toString("base64");
      await setPoliceAudio(key, base64);

      console.log(`  Stored ${key} (${Math.round(base64.length / 1024)} KB base64)`);
    }
  }

  console.log("Done! All police intro audio generated and stored.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
