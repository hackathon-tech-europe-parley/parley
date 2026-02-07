import type { LanguageCode } from "@/lib/types";

export type Level = "beginner" | "intermediate" | "advanced" | "impossible";

export interface ScenarioDef {
  key: string;
  scenario: string;
  emoji: string;
}

export const LANGUAGES = [
  { code: "en", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "fr", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "de", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "pt", flag: "\u{1F1E7}\u{1F1F7}" },
] as const;

// English names sent to the API (the AI prompt always uses English)
export const LANGUAGE_ENGLISH_NAMES: Record<LanguageCode, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
};

export const SCENARIOS: ScenarioDef[] = [
  {
    key: "taxi",
    scenario:
      "You just landed at the airport and hopped in a taxi. The driver seems friendly but the meter looks suspiciously high. You need to get to your hotel downtown.",
    emoji: "\u{1F695}",
  },
  {
    key: "cafe",
    scenario:
      "You walk into a cozy neighborhood caf\u00e9 for breakfast. The menu is only in the local language and the barista doesn't speak English.",
    emoji: "\u2615",
  },
  {
    key: "lost",
    scenario:
      "You're lost in a busy city center. Your phone is dead and you need to find your way to the main train station. A local is walking by.",
    emoji: "\u{1F5FA}\uFE0F",
  },
  {
    key: "market",
    scenario:
      "You're at a vibrant street market filled with handmade goods. A vendor catches your eye and starts pitching their wares enthusiastically.",
    emoji: "\u{1F6CD}\uFE0F",
  },
  {
    key: "hotel",
    scenario:
      "You arrive at your hotel after a long journey but the receptionist can't find your reservation. There seems to be a mix-up with the dates.",
    emoji: "\u{1F3E8}",
  },
  {
    key: "doctor",
    scenario:
      "You've been feeling unwell and visit a local clinic. The doctor speaks only the local language and needs to understand your symptoms.",
    emoji: "\u{1FA7A}",
  },
  {
    key: "friends",
    scenario:
      "You're at a local cultural event and the person next to you starts a friendly conversation. They're curious about where you're from.",
    emoji: "\u{1F389}",
  },
  {
    key: "interview",
    scenario:
      "You're interviewing for a position at a local company. The interviewer wants to test your language skills as part of the role requires client communication.",
    emoji: "\u{1F4BC}",
  },
  {
    key: "restaurant",
    scenario:
      "You ordered a specific dish at a nice restaurant, but the waiter brought something completely different. You also have food allergies to communicate.",
    emoji: "\u{1F37D}\uFE0F",
  },
  {
    key: "apartment",
    scenario:
      "You're looking to rent an apartment and the landlord is showing you around. You need to ask about the price, utilities, and neighborhood.",
    emoji: "\u{1F3E0}",
  },
  {
    key: "train",
    scenario:
      "You're at a busy train station and the departure board is confusing. A station worker notices you looking lost.",
    emoji: "\u{1F682}",
  },
  {
    key: "pharmacy",
    scenario:
      "You need a specific medication but the pharmacist needs to understand your situation to recommend the right product. The brand names are all different here.",
    emoji: "\u{1F48A}",
  },
];

export const LEVEL_KEYS: Level[] = [
  "beginner",
  "intermediate",
  "advanced",
  "impossible",
];

export function shuffleArray<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
