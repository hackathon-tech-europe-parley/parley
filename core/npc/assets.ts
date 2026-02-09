import { createLogger } from "@/core/logger";
import type { NpcGender } from "@/core/types";

const log = createLogger("game:npc-assets");

const GENDER_MAP: Record<NpcGender, string> = {
  masculine: "man",
  feminine: "woman",
};

const VALID_MOODS = new Set([
  "amused",
  "annoyed",
  "convinced",
  "firm",
  "friendly",
  "furious",
  "patient",
  "skeptical",
]);

// Map normalized 8 mood states to available asset moods
const MOOD_FALLBACK: Record<string, string> = {
  happy: "amused",
  friendly: "friendly",
  neutral: "patient",
  skeptical: "skeptical",
  annoyed: "annoyed",
  angry: "furious",
  sad: "annoyed",
  surprised: "amused",
};

const DEFAULT_MOOD = "friendly";

export function getNpcFaceAssetUrl(
  scenarioKey: string,
  npcGender: NpcGender,
  mood: string,
): string {
  if (scenarioKey === "__custom__") {
    return "";
  }

  const gender = GENDER_MAP[npcGender];
  const normalizedMood = mood.toLowerCase();
  const resolvedMood = VALID_MOODS.has(normalizedMood)
    ? normalizedMood
    : (MOOD_FALLBACK[normalizedMood] ?? DEFAULT_MOOD);

  if (resolvedMood !== normalizedMood) {
    log.debug({ mood, resolvedMood }, "mood mapped to fallback asset");
  }

  return `/assets/${scenarioKey}/${gender}_${resolvedMood}.webp`;
}

// Get special person (e.g., policeman/policewoman) face image based on mood
// type should be "policeman" or "policewoman"
export function getSpecialPersonFaceAssetUrl(
  type: string,
  mood: string,
): string {
  const normalizedMood = mood.toLowerCase();
  const resolvedMood = VALID_MOODS.has(normalizedMood)
    ? normalizedMood
    : (MOOD_FALLBACK[normalizedMood] ?? DEFAULT_MOOD);

  return `/assets/special/${type}/${type}_${resolvedMood}.png`;
}

// Determine police officer type based on NPC gender (opposite gender)
export function getPoliceOfficerType(
  npcGender: NpcGender,
): "policeman" | "policewoman" {
  return npcGender === "masculine" ? "policewoman" : "policeman";
}

// Get police officer name based on type
export function getPoliceOfficerName(
  type: "policeman" | "policewoman",
): string {
  return type === "policeman" ? "Officer" : "Officer";
}

// Predefined police intro messages per language — fast, no LLM call needed
export const POLICE_INTRO_MESSAGES: Record<string, string> = {
  en: "Police! Nobody move. You — you're in serious trouble. Stay right where you are.",
  fr: "Police ! Ne bougez plus. Vous — vous avez de gros problèmes. Restez exactement où vous êtes.",
  de: "Polizei! Keine Bewegung. Sie — Sie stecken in ernsthaften Schwierigkeiten. Bleiben Sie genau wo Sie sind.",
  es: "¡Policía! ¡Que nadie se mueva! Usted — está en serios problemas. Quédese exactamente donde está.",
  pt: "Polícia! Ninguém se mexe. Você — está em sérios problemas. Fique exatamente onde está.",
};

export function getPoliceIntroMessage(languageCode: string): string {
  return POLICE_INTRO_MESSAGES[languageCode] ?? POLICE_INTRO_MESSAGES.en;
}

// Line the NPC says when calling the police — appended if tone enforcement removed the original mention
const POLICE_CALLING_LINES: Record<string, string> = {
  en: "I'm calling the police!",
  fr: "J'appelle la police !",
  de: "Ich rufe die Polizei!",
  es: "¡Llamo a la policía!",
  pt: "Estou chamando a polícia!",
};

export function getPoliceCallingLine(languageCode: string): string {
  return POLICE_CALLING_LINES[languageCode] ?? POLICE_CALLING_LINES.en;
}
