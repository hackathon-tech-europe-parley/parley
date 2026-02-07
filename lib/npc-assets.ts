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

const MOOD_FALLBACK: Record<string, string> = {
  neutral: "patient",
  happy: "amused",
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
