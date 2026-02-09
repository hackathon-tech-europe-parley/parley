import { GRADIUM_API_KEY, getGradiumTtsPaddingBonus } from "@/core/env";
import { createLogger } from "@/core/logger";
import { type NpcGender, normalizeToMoodState } from "@/core/types";

const log = createLogger("infra:tts:gradium");

// Serialize TTS requests to avoid Gradium concurrency limit (max 2 sessions)
let pending: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn, fn);
  pending = next.then(
    () => {},
    () => {},
  );
  return next;
}

// Flagship voices per language and gender
export const VOICE_MAP: Record<string, Record<NpcGender, string>> = {
  en: { feminine: "YTpq7expH9539ERJ", masculine: "LFZvm12tW_z0xfGo" }, // Emma / Kent
  fr: { feminine: "b35yykvVppLXyw_l", masculine: "axlOaUiFyOZhy4nv" }, // Elise / Leo
  de: { feminine: "-uP9MuGtBqAvEyxI", masculine: "0y1VZjPabOBU3rWy" }, // Mia / Maximilian
  es: { feminine: "B36pbz5_UoWn4BDl", masculine: "xu7iJ_fn2ElcWp2s" }, // Valentina / Sergio
  pt: { feminine: "pYcGZz9VOo4n2ynh", masculine: "M-FvVo9c-jGR4PgP" }, // Alice / Davi
};

const DEFAULT_VOICE = "YTpq7expH9539ERJ"; // Emma

export function getVoiceId(languageCode?: string, gender?: NpcGender): string {
  const g = gender ?? "feminine";
  if (languageCode && VOICE_MAP[languageCode]) {
    return VOICE_MAP[languageCode][g];
  }
  return VOICE_MAP.en?.[g] ?? DEFAULT_VOICE;
}

// Map mood states to Gradium TTS json_config overrides.
// temp (0–1.4): higher = more expressive/varied intonation.
// padding_bonus (-4–4): negative = faster, positive = slower pacing.
const MOOD_TTS_CONFIG: Record<
  string,
  { tempOffset: number; paddingOffset: number }
> = {
  happy: { tempOffset: 0.3, paddingOffset: -0.3 },
  friendly: { tempOffset: 0.2, paddingOffset: 0.0 },
  neutral: { tempOffset: 0.0, paddingOffset: 0.0 },
  skeptical: { tempOffset: 0.1, paddingOffset: 0.3 },
  annoyed: { tempOffset: 0.3, paddingOffset: -0.3 },
  angry: { tempOffset: 0.5, paddingOffset: -0.5 },
  sad: { tempOffset: -0.1, paddingOffset: 0.5 },
  surprised: { tempOffset: 0.4, paddingOffset: -0.2 },
};

export function synthesizeSpeech(
  text: string,
  languageCode?: string,
  gender?: NpcGender,
  speed?: number,
  mood?: string,
): Promise<ArrayBuffer> {
  return enqueue(async () => {
    const voiceId = getVoiceId(languageCode, gender);
    log.info(
      { languageCode, gender, voiceId, mood, textLength: text.length },
      "synthesizing speech",
    );
    const start = Date.now();
    const apiKey = GRADIUM_API_KEY;
    const basePayload = {
      text,
      voice_id: getVoiceId(languageCode, gender),
      output_format: "wav",
      only_audio: true,
    };
    // Convert speed (0.5-2.0) to padding_bonus:
    // speed 0.5 (slowest) → padding_bonus 2.0
    // speed 1.0 (normal) → padding_bonus 0.0
    // speed 2.0 (fastest) → padding_bonus -2.0
    // Falls back to env-configured value if no speed provided.
    const basePadding =
      speed !== undefined ? (1.0 - speed) * 2.0 : getGradiumTtsPaddingBonus();

    // Apply mood-based offsets to temp and padding_bonus
    const moodState = mood ? normalizeToMoodState(mood) : "neutral";
    const moodConfig = MOOD_TTS_CONFIG[moodState] ?? MOOD_TTS_CONFIG.neutral;
    const paddingBonus = basePadding + moodConfig.paddingOffset;
    const temp = Math.min(1.4, Math.max(0, 0.7 + moodConfig.tempOffset));

    const fastPayload = {
      ...basePayload,
      json_config: JSON.stringify({
        padding_bonus: paddingBonus,
        temp,
      }),
    };
    let res = await fetch("https://eu.api.gradium.ai/api/post/speech/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(fastPayload),
    });

    // If this voice/model does not support padding_bonus, retry with plain payload.
    if (!res.ok && (res.status === 400 || res.status === 422)) {
      res = await fetch("https://eu.api.gradium.ai/api/post/speech/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(basePayload),
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error({ status: res.status }, "Gradium TTS request failed");
      throw new Error(`Gradium TTS failed (${res.status}): ${body}`);
    }

    const audio = await res.arrayBuffer();
    log.info(
      { durationMs: Date.now() - start, responseBytes: audio.byteLength },
      "speech synthesized",
    );
    return audio;
  });
}
