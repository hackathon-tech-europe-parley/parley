export const CONVERSATION_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "impossible",
] as const;

export const GOAL_STATUSES = ["ongoing", "achieved", "failed"] as const;

export const GOAL_PROGRESS_VALUES = [1, 2, 3, 4, 5] as const;

export const CONVERSATION_ROLES = ["user", "npc"] as const;

export const LANGUAGE_CODES = ["en", "fr", "de", "es", "pt"] as const;

export const NPC_GENDERS = ["masculine", "feminine"] as const;

export type ConversationLevel = (typeof CONVERSATION_LEVELS)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type GoalProgress = (typeof GOAL_PROGRESS_VALUES)[number];
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];
export type LanguageCode = (typeof LANGUAGE_CODES)[number];
export type NpcGender = (typeof NPC_GENDERS)[number];

// 8 core mood states
export type MoodState =
  | "happy"
  | "friendly"
  | "neutral"
  | "skeptical"
  | "annoyed"
  | "angry"
  | "sad"
  | "surprised";

// Normalize any mood string to one of the 8 states
export function normalizeToMoodState(mood: string): MoodState {
  const m = mood.toLowerCase();

  if (
    [
      "happy",
      "joyful",
      "pleased",
      "cheerful",
      "delighted",
      "ecstatic",
      "elated",
      "encouraging",
      "impressed",
    ].some((k) => m.includes(k))
  ) {
    return "happy";
  }
  if (
    [
      "friendly",
      "warm",
      "welcoming",
      "kind",
      "pleasant",
      "amiable",
      "cordial",
    ].some((k) => m.includes(k))
  ) {
    return "friendly";
  }
  if (
    [
      "neutral",
      "calm",
      "professional",
      "balanced",
      "composed",
      "steady",
      "focused",
      "patient",
      "firm",
    ].some((k) => m.includes(k))
  ) {
    return "neutral";
  }
  if (
    [
      "skeptical",
      "doubtful",
      "wary",
      "suspicious",
      "distrustful",
      "guarded",
      "questioning",
      "unconvinced",
    ].some((k) => m.includes(k))
  ) {
    return "skeptical";
  }
  if (
    [
      "annoyed",
      "irritated",
      "frustrated",
      "impatient",
      "exasperated",
      "bothered",
      "aggravated",
    ].some((k) => m.includes(k))
  ) {
    return "annoyed";
  }
  if (
    [
      "angry",
      "hostile",
      "furious",
      "enraged",
      "aggressive",
      "livid",
      "incensed",
      "cold",
      "distant",
    ].some((k) => m.includes(k))
  ) {
    return "angry";
  }
  if (
    [
      "sad",
      "melancholic",
      "gloomy",
      "somber",
      "dejected",
      "disappointed",
      "downcast",
      "sorrowful",
    ].some((k) => m.includes(k))
  ) {
    return "sad";
  }
  if (
    [
      "surprised",
      "shocked",
      "amazed",
      "astonished",
      "taken aback",
      "startled",
      "bewildered",
    ].some((k) => m.includes(k))
  ) {
    return "surprised";
  }

  return "neutral";
}
