import type { GoalStatus, LanguageCode } from "@/core/types";

export interface BuildSceneImagePromptInput {
  scenario: string;
  language?: string;
  languageCode?: LanguageCode;
  scenarioKey?: string;
  npcName?: string;
  npcPersonality?: string;
  mood?: string;
  outcome?: GoalStatus | "quit";
}

interface LanguageSceneContext {
  language: string;
  country: string;
  localeCue: string;
}

interface ScenarioSceneContext {
  counterpartRole: string;
  environment: string;
}

const LANGUAGE_SCENE_CONTEXT: Record<LanguageCode, LanguageSceneContext> = {
  en: {
    language: "English",
    country: "the United Kingdom",
    localeCue:
      "British street signs, transport markings, architecture, and urban details",
  },
  fr: {
    language: "French",
    country: "France",
    localeCue:
      "French signage, cafe details, storefront typography, and city textures",
  },
  de: {
    language: "German",
    country: "Germany",
    localeCue:
      "German wayfinding signs, station labels, architecture, and public design cues",
  },
  es: {
    language: "Spanish",
    country: "Spain",
    localeCue:
      "Spanish street signs, menu wording, storefront details, and local city atmosphere",
  },
  pt: {
    language: "Portuguese",
    country: "Portugal",
    localeCue:
      "Portuguese signs, tile and facade details, transit labels, and local urban character",
  },
};

const LANGUAGE_NAME_TO_CODE: Record<string, LanguageCode> = {
  english: "en",
  french: "fr",
  german: "de",
  spanish: "es",
  portuguese: "pt",
};

const SCENARIO_SCENE_CONTEXT: Record<string, ScenarioSceneContext> = {
  taxi: {
    counterpartRole: "a local taxi driver",
    environment:
      "inside a taxi leaving an international airport with dashboard details, meter visibility, and city approach roads",
  },
  cafe: {
    counterpartRole: "a barista",
    environment:
      "inside a neighborhood cafe with menu boards, counter setup, tableware, and morning light",
  },
  lost: {
    counterpartRole: "a local passerby",
    environment:
      "in a busy city center with wayfinding signs, intersections, transit markers, and pedestrian flow",
  },
  market: {
    counterpartRole: "a street market vendor",
    environment:
      "at an outdoor market with stalls, handwritten price signs, colorful goods, and narrow walkways",
  },
  hotel: {
    counterpartRole: "a hotel receptionist",
    environment:
      "at a hotel front desk with reservation screens, key card trays, luggage corners, and lobby lighting",
  },
  doctor: {
    counterpartRole: "a local doctor",
    environment:
      "inside a clinic consultation room with medical posters, desk tools, exam equipment, and waiting-area cues",
  },
  friends: {
    counterpartRole: "a local event attendee",
    environment:
      "at a cultural event with banners, informational stands, gathering areas, and casual social ambience",
  },
  interview: {
    counterpartRole: "a job interviewer",
    environment:
      "inside a company meeting room with chairs facing each other, documents, notebooks, and office glass partitions",
  },
  restaurant: {
    counterpartRole: "a waiter",
    environment:
      "inside a restaurant dining area with table settings, order slips, menu cards, and service pathways",
  },
  apartment: {
    counterpartRole: "a landlord",
    environment:
      "inside an apartment viewing with open rooms, utility fixtures, window views, and rental paperwork cues",
  },
  train: {
    counterpartRole: "a station worker",
    environment:
      "at a train station with departure boards, platform signs, ticketing machines, and platform edge details",
  },
  pharmacy: {
    counterpartRole: "a pharmacist",
    environment:
      "inside a pharmacy with medicine shelves, consultation counter, product labels, and queue markers",
  },
};

const DEFAULT_SCENARIO_CONTEXT: ScenarioSceneContext = {
  counterpartRole: "a local person relevant to the scenario",
  environment:
    "a realistic public or private setting grounded in the scenario details, with clear location-specific objects",
};

export function buildSceneImagePrompt({
  scenario,
  language,
  languageCode,
  scenarioKey,
  npcName,
  npcPersonality,
  mood = "neutral",
  outcome,
}: BuildSceneImagePromptInput): string {
  const languageContext = resolveLanguageSceneContext(language, languageCode);
  const scenarioContext =
    (scenarioKey ? SCENARIO_SCENE_CONTEXT[scenarioKey] : undefined) ??
    DEFAULT_SCENARIO_CONTEXT;
  const counterpartDescription = describeCounterpart(
    scenarioContext.counterpartRole,
    npcName,
    npcPersonality,
  );
  const moodTone = describeMoodTone(mood);
  const counterpartMood = describeCounterpartMood(mood);
  const outcomeTone = describeOutcomeTone(outcome);

  return [
    `Photorealistic background scene for a language-learning roleplay: ${scenario}.`,
    `Country context: ${languageContext.country}.`,
    `Spoken language context: ${languageContext.language}.`,
    `Regional cues: ${languageContext.localeCue}.`,
    `You are interacting with ${counterpartDescription}.`,
    `Environment details: ${scenarioContext.environment}.`,
    `Counterpart mood: ${counterpartMood}. Express this through atmosphere and objects only.`,
    `Atmosphere: ${moodTone}.`,
    outcomeTone,
    "No people visible in frame; show only environment and contextual objects.",
    "First-person perspective from the learner's point of view.",
    "Cinematic realism, natural lighting, and grounded textures.",
  ]
    .filter(Boolean)
    .join(" ");
}

function describeCounterpart(
  counterpartRole: string,
  npcName?: string,
  npcPersonality?: string,
): string {
  const namedRole = npcName
    ? `${npcName}, who is ${counterpartRole}`
    : counterpartRole;

  return npcPersonality
    ? `${namedRole}. Their personality is ${npcPersonality}`
    : namedRole;
}

function resolveLanguageSceneContext(
  language?: string,
  languageCode?: LanguageCode,
): LanguageSceneContext {
  const inferredCode = inferLanguageCode(language, languageCode);
  if (inferredCode) {
    return LANGUAGE_SCENE_CONTEXT[inferredCode];
  }

  return {
    language: language ?? "the local language",
    country: "a country where the target language is commonly spoken",
    localeCue:
      "authentic local signage, architecture, and public environment cues",
  };
}

function inferLanguageCode(
  language?: string,
  languageCode?: LanguageCode,
): LanguageCode | undefined {
  if (languageCode) return languageCode;
  if (!language) return undefined;
  return LANGUAGE_NAME_TO_CODE[language.trim().toLowerCase()];
}

function describeMoodTone(mood: string): string {
  switch (mood) {
    case "happy":
      return "uplifting and optimistic";
    case "friendly":
      return "welcoming and calm";
    case "neutral":
      return "balanced and realistic";
    case "skeptical":
      return "wary and uncertain";
    case "annoyed":
      return "frustrated and tense";
    case "angry":
      return "hostile and intense";
    case "sad":
      return "somber and subdued";
    case "surprised":
      return "suddenly tense and alert";
    default:
      return "balanced and realistic";
  }
}

function describeCounterpartMood(mood: string): string {
  switch (mood) {
    case "happy":
      return "pleased and open";
    case "friendly":
      return "approachable and patient";
    case "neutral":
      return "composed and professional";
    case "skeptical":
      return "guarded and doubtful";
    case "annoyed":
      return "irritated and impatient";
    case "angry":
      return "confrontational and severe";
    case "sad":
      return "downcast and emotionally drained";
    case "surprised":
      return "alert and unsettled";
    default:
      return "composed and professional";
  }
}

function describeOutcomeTone(outcome?: GoalStatus | "quit"): string {
  switch (outcome) {
    case "achieved":
      return "The scene should feel resolved and calmer than before.";
    case "failed":
      return "The scene should feel tense, unresolved, and emotionally heavy.";
    case "quit":
      return "The scene should feel paused and unfinished, with slight unresolved tension.";
    default:
      return "";
  }
}
