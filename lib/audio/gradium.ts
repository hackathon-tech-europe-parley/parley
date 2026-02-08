import type { NpcGender } from "../types";
import { getGradiumApiKey, getGradiumTtsPaddingBonus } from "../env";

// Serialize TTS requests to avoid Gradium concurrency limit (max 2 sessions)
let pending: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn, fn);
  pending = next.then(() => {}, () => {});
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
  return VOICE_MAP["en"]?.[g] ?? DEFAULT_VOICE;
}

export function synthesizeSpeech(
  text: string,
  languageCode?: string,
  gender?: NpcGender,
  speed?: number,
): Promise<ArrayBuffer> {
  return enqueue(async () => {
    const apiKey = getGradiumApiKey();
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
    const paddingBonus = speed !== undefined
      ? (1.0 - speed) * 2.0
      : getGradiumTtsPaddingBonus();
    const fastPayload = {
      ...basePayload,
      json_config: JSON.stringify({
        padding_bonus: paddingBonus,
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
      throw new Error(`Gradium TTS failed (${res.status}): ${body}`);
    }

    return res.arrayBuffer();
  });
}
