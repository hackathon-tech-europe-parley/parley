import type { NpcGender } from "@/core/types";

export interface TTSProvider {
  synthesize(
    text: string,
    languageCode?: string,
    gender?: NpcGender,
    speed?: number,
    mood?: string,
  ): Promise<ArrayBuffer>;

  getVoiceId(languageCode?: string, gender?: NpcGender): string;
}

// Default provider: Gradium
export { getVoiceId, synthesizeSpeech, VOICE_MAP } from "./gradium";
