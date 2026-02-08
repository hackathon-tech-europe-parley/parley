import type { NpcGender } from "./types";

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
    : MOOD_FALLBACK[normalizedMood] ?? DEFAULT_MOOD;

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
    : MOOD_FALLBACK[normalizedMood] ?? DEFAULT_MOOD;

  return `/assets/special/${type}/${type}_${resolvedMood}.png`;
}

// Determine police officer type based on NPC gender (opposite gender)
export function getPoliceOfficerType(npcGender: NpcGender): "policeman" | "policewoman" {
  return npcGender === "masculine" ? "policewoman" : "policeman";
}

// Get police officer name based on type
export function getPoliceOfficerName(type: "policeman" | "policewoman"): string {
  return type === "policeman" ? "Officer" : "Officer";
}
