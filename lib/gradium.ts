const GRADIUM_API_KEY = process.env.GRADIUM_API_KEY!;

// Default flagship voice per language
const VOICE_MAP: Record<string, string> = {
  en: "YTpq7expH9539ERJ", // Emma (English US)
  fr: "b35yykvVppLXyw_l", // Elise (French)
  de: "-uP9MuGtBqAvEyxI", // Mia (German)
  es: "B36pbz5_UoWn4BDl", // Valentina (Spanish)
  pt: "pYcGZz9VOo4n2ynh", // Alice (Portuguese)
};

const DEFAULT_VOICE = "YTpq7expH9539ERJ";

export function getVoiceId(languageCode?: string): string {
  if (languageCode && VOICE_MAP[languageCode]) {
    return VOICE_MAP[languageCode];
  }
  return DEFAULT_VOICE;
}

export async function synthesizeSpeech(text: string, languageCode?: string): Promise<ArrayBuffer> {
  const res = await fetch("https://eu.api.gradium.ai/api/post/speech/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": GRADIUM_API_KEY,
    },
    body: JSON.stringify({
      text,
      voice_id: getVoiceId(languageCode),
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
