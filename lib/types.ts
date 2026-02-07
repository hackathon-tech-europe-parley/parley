import { z } from "zod";

const CONVERSATION_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "impossible",
] as const;
const GOAL_STATUSES = ["ongoing", "achieved", "failed"] as const;
const GOAL_PROGRESS_VALUES = [1, 2, 3, 4, 5] as const;
const CONVERSATION_ROLES = ["user", "npc"] as const;
const LANGUAGE_CODES = ["en", "fr", "de", "es", "pt"] as const;

export type ConversationLevel = (typeof CONVERSATION_LEVELS)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type GoalProgress = (typeof GOAL_PROGRESS_VALUES)[number];
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface ConversationMessage {
  role: ConversationRole;
  text: string;
}

export interface Conversation {
  scenario: string;
  language: string;
  level: ConversationLevel;
  goal: string;
  npcName: string;
  npcPersonality: string;
  mood: string;
  goalProgress: GoalProgress;
  hostilityStreak: number;
  disengagedStreak: number;
  constructiveStreak: number;
  history: ConversationMessage[];
  messagesSinceImageRegen: number;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  scenarioKey?: string;
  languageCode?: LanguageCode;
}

export interface NpcEvaluation {
  cooperation: number;
  relevance: number;
  politeness: number;
  clarity: number;
  taskIntent: number;
  offTopic: boolean;
  refusal: boolean;
  hostile: boolean;
}

export interface NpcResponse {
  npcMessage: string;
  mood: string;
  goalStatus: GoalStatus;
  goalProgress: GoalProgress;
  evaluation: NpcEvaluation;
  hints: string[];
}

export interface NpcProfile {
  name: string;
  personality: string;
}

export interface Debrief {
  narrative: string;
  keyPhrases: Array<{ phrase: string; translation: string }>;
  goalAchieved: boolean;
}

export interface ConversationSnapshot {
  conversationId: string;
  scenario: string;
  language: string;
  level: ConversationLevel;
  goal: string;
  npcName: string;
  mood: string;
  goalProgress: GoalProgress;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  history: ConversationMessage[];
  hints: string[];
  scenarioKey?: string;
  languageCode?: LanguageCode;
}

export interface CustomScenario {
  title: string;
  description: string;
  emoji: string;
  scenario: string;
  goals: {
    beginner: string;
    intermediate: string;
    advanced: string;
    impossible: string;
  };
}

export interface CreateConversationResponse {
  conversationId: string;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  npcName: string;
  npcOpeningMessage: string;
  npcOpeningMood: string;
  npcOpeningGoalProgress: GoalProgress;
  hints: string[];
  scenario: string;
  goal: string;
  language: string;
  level: ConversationLevel;
}

export interface QuitConversationResponse {
  debrief: Debrief;
  sceneImageUrl: string;
  npcName: string;
  goalStatus: "quit";
  conversationHistory: ConversationMessage[];
}

export interface MessageStreamCompletePayload {
  npcMessage: string;
  mood: string;
  goalStatus: GoalStatus;
  goalProgress: GoalProgress;
  hints: string[];
  sceneImageUrl: string;
  npcFaceImageUrl?: string;
  debrief?: Debrief;
}

export const languageCodeSchema = z.enum(LANGUAGE_CODES);
export const conversationLevelSchema = z.enum(CONVERSATION_LEVELS);
export const goalStatusSchema = z.enum(GOAL_STATUSES);
export const conversationRoleSchema = z.enum(CONVERSATION_ROLES);

const nonEmptyStringSchema = z.string().trim().min(1);

export const goalProgressSchema = z
  .number()
  .int()
  .min(1)
  .max(5)
  .transform((value) => value as GoalProgress);

export const idParamSchema = z.string().uuid();

export const conversationMessageSchema = z
  .object({
    role: conversationRoleSchema,
    text: nonEmptyStringSchema,
  })
  .strict();

export const createConversationSchema = z
  .object({
    scenario: nonEmptyStringSchema,
    language: nonEmptyStringSchema,
    level: conversationLevelSchema,
    goal: nonEmptyStringSchema,
    scenarioKey: nonEmptyStringSchema.optional(),
    languageCode: languageCodeSchema.optional(),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    message: nonEmptyStringSchema,
  })
  .strict();

export const generateScenarioSchema = z
  .object({
    prompt: nonEmptyStringSchema,
  })
  .strict();

export const ttsRequestSchema = z
  .object({
    text: nonEmptyStringSchema,
    languageCode: languageCodeSchema.optional(),
  })
  .strict();

export const sttRequestSchema = z
  .object({
    audio: nonEmptyStringSchema,
    languageCode: languageCodeSchema.optional(),
  })
  .strict();

export const sttResponseSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    error: nonEmptyStringSchema,
  })
  .strict();

export const npcEvaluationSchema = z
  .object({
    cooperation: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
    politeness: z.number().min(0).max(1),
    clarity: z.number().min(0).max(1),
    taskIntent: z.number().min(0).max(1),
    offTopic: z.boolean(),
    refusal: z.boolean(),
    hostile: z.boolean(),
  })
  .strict();

export const npcResponseSchema = z
  .object({
    npcMessage: nonEmptyStringSchema,
    mood: nonEmptyStringSchema,
    goalStatus: goalStatusSchema,
    goalProgress: goalProgressSchema,
    evaluation: npcEvaluationSchema,
    hints: z.array(nonEmptyStringSchema),
  })
  .strict();

export const npcProfileSchema = z
  .object({
    name: nonEmptyStringSchema,
    personality: nonEmptyStringSchema,
  })
  .strict();

export const debriefPhraseSchema = z
  .object({
    phrase: nonEmptyStringSchema,
    translation: nonEmptyStringSchema,
  })
  .strict();

export const debriefSchema = z
  .object({
    narrative: nonEmptyStringSchema,
    keyPhrases: z.array(debriefPhraseSchema),
    goalAchieved: z.boolean(),
  })
  .strict();

export const customScenarioSchema = z
  .object({
    title: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    emoji: nonEmptyStringSchema,
    scenario: nonEmptyStringSchema,
    goals: z
      .object({
        beginner: nonEmptyStringSchema,
        intermediate: nonEmptyStringSchema,
        advanced: nonEmptyStringSchema,
        impossible: nonEmptyStringSchema,
      })
      .strict(),
  })
  .strict();

export const conversationSchema = z
  .object({
    scenario: nonEmptyStringSchema,
    language: nonEmptyStringSchema,
    level: conversationLevelSchema,
    goal: nonEmptyStringSchema,
    npcName: nonEmptyStringSchema,
    npcPersonality: nonEmptyStringSchema,
    mood: nonEmptyStringSchema,
    goalProgress: goalProgressSchema,
    hostilityStreak: z.number().int().min(0),
    disengagedStreak: z.number().int().min(0),
    constructiveStreak: z.number().int().min(0),
    history: z.array(conversationMessageSchema),
    messagesSinceImageRegen: z.number().int().min(0),
    sceneImageUrl: nonEmptyStringSchema,
    npcFaceImageUrl: z.string(),
    scenarioKey: nonEmptyStringSchema.optional(),
    languageCode: languageCodeSchema.optional(),
  })
  .strict();

export const conversationSnapshotSchema = z
  .object({
    conversationId: idParamSchema,
    scenario: nonEmptyStringSchema,
    language: nonEmptyStringSchema,
    level: conversationLevelSchema,
    goal: nonEmptyStringSchema,
    npcName: nonEmptyStringSchema,
    mood: nonEmptyStringSchema,
    goalProgress: goalProgressSchema,
    sceneImageUrl: nonEmptyStringSchema,
    npcFaceImageUrl: z.string(),
    history: z.array(conversationMessageSchema),
    hints: z.array(nonEmptyStringSchema),
    scenarioKey: nonEmptyStringSchema.optional(),
    languageCode: languageCodeSchema.optional(),
  })
  .strict();

export const createConversationResponseSchema = z
  .object({
    conversationId: idParamSchema,
    sceneImageUrl: nonEmptyStringSchema,
    npcFaceImageUrl: z.string(),
    npcName: nonEmptyStringSchema,
    npcOpeningMessage: nonEmptyStringSchema,
    npcOpeningMood: nonEmptyStringSchema,
    npcOpeningGoalProgress: goalProgressSchema,
    hints: z.array(nonEmptyStringSchema),
    scenario: nonEmptyStringSchema,
    goal: nonEmptyStringSchema,
    language: nonEmptyStringSchema,
    level: conversationLevelSchema,
  })
  .strict();

export const conversationCacheSchema = createConversationResponseSchema
  .extend({
    scenarioKey: nonEmptyStringSchema.optional(),
    languageCode: languageCodeSchema.optional(),
  })
  .strict();

export const quitConversationResponseSchema = z
  .object({
    debrief: debriefSchema,
    sceneImageUrl: nonEmptyStringSchema,
    npcName: nonEmptyStringSchema,
    goalStatus: z.literal("quit"),
    conversationHistory: z.array(conversationMessageSchema),
  })
  .strict();

export const messageStreamTokenPayloadSchema = z
  .object({
    text: z.string(),
  })
  .strict();

export const messageStreamCompletePayloadSchema = z
  .object({
    npcMessage: nonEmptyStringSchema,
    mood: nonEmptyStringSchema,
    goalStatus: goalStatusSchema,
    goalProgress: goalProgressSchema,
    hints: z.array(nonEmptyStringSchema),
    sceneImageUrl: nonEmptyStringSchema,
    npcFaceImageUrl: z.string().optional(),
    debrief: debriefSchema.optional(),
  })
  .strict();

export const messageStreamErrorPayloadSchema = z
  .object({
    error: nonEmptyStringSchema,
  })
  .strict();

export const sttServerMessageSchema = z
  .object({
    type: nonEmptyStringSchema,
    text: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

const DEFAULT_NPC_EVALUATION: NpcEvaluation = {
  cooperation: 0.5,
  relevance: 0.5,
  politeness: 0.5,
  clarity: 0.5,
  taskIntent: 0.5,
  offTopic: false,
  refusal: false,
  hostile: false,
};

const unitScoreFromUnknownSchema = z.coerce
  .number()
  .finite()
  .transform((value) => Math.min(1, Math.max(0, value)));

const booleanFromUnknownSchema = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    return value.trim().toLowerCase() === "true";
  });

const moodFromUnknownSchema = z
  .string()
  .trim()
  .min(1)
  .catch("neutral");

const hintsFromUnknownSchema = z
  .array(z.string())
  .transform((hints) => hints.map((hint) => hint.trim()).filter(Boolean))
  .catch([]);

const goalStatusFromUnknownSchema = goalStatusSchema.catch("ongoing");

export const npcEvaluationFromLlmSchema = z
  .object({
    cooperation: unitScoreFromUnknownSchema.catch(0.5),
    relevance: unitScoreFromUnknownSchema.catch(0.5),
    politeness: unitScoreFromUnknownSchema.catch(0.5),
    clarity: unitScoreFromUnknownSchema.catch(0.5),
    taskIntent: unitScoreFromUnknownSchema.catch(0.5),
    offTopic: booleanFromUnknownSchema.catch(false),
    refusal: booleanFromUnknownSchema.catch(false),
    hostile: booleanFromUnknownSchema.catch(false),
  })
  .catch(DEFAULT_NPC_EVALUATION);

export const npcProfileFromLlmSchema = z
  .object({
    name: z.string().trim().min(1).catch("NPC"),
    personality: z.string().trim().min(1).catch("Neutral personality."),
  })
  .catch({ name: "NPC", personality: "Neutral personality." });

export const customScenarioFromLlmSchema = z
  .object({
    title: z.string().trim().min(1).catch("Custom scenario"),
    description: z
      .string()
      .trim()
      .min(1)
      .catch("Practice this custom language scenario."),
    emoji: z.string().trim().min(1).catch("\ud83c\udfad"),
    scenario: z
      .string()
      .trim()
      .min(1)
      .catch("You are in a realistic social scenario."),
    goals: z
      .object({
        beginner: z.string().trim().min(1).catch("Introduce yourself politely."),
        intermediate: z
          .string()
          .trim()
          .min(1)
          .catch("Handle a natural back-and-forth conversation."),
        advanced: z
          .string()
          .trim()
          .min(1)
          .catch("Negotiate a nuanced outcome with confidence."),
        impossible: z
          .string()
          .trim()
          .min(1)
          .catch("Achieve an over-the-top impossible objective."),
      })
      .catch({
        beginner: "Introduce yourself politely.",
        intermediate: "Handle a natural back-and-forth conversation.",
        advanced: "Negotiate a nuanced outcome with confidence.",
        impossible: "Achieve an over-the-top impossible objective.",
      }),
  })
  .catch({
    title: "Custom scenario",
    description: "Practice this custom language scenario.",
    emoji: "\ud83c\udfad",
    scenario: "You are in a realistic social scenario.",
    goals: {
      beginner: "Introduce yourself politely.",
      intermediate: "Handle a natural back-and-forth conversation.",
      advanced: "Negotiate a nuanced outcome with confidence.",
      impossible: "Achieve an over-the-top impossible objective.",
    },
  });

export const debriefFromLlmSchema = z
  .object({
    narrative: z
      .string()
      .trim()
      .min(1)
      .catch("The conversation has ended."),
    keyPhrases: z
      .array(
        z
          .object({
            phrase: z.string().trim().min(1).catch(""),
            translation: z.string().trim().min(1).catch(""),
          })
          .transform((value) => ({
            phrase: value.phrase,
            translation: value.translation,
          })),
      )
      .transform((values) =>
        values.filter((value) => value.phrase.length > 0 && value.translation.length > 0),
      )
      .catch([]),
  })
  .catch({ narrative: "The conversation has ended.", keyPhrases: [] });

function clampGoalProgress(value: number, fallback: GoalProgress): GoalProgress {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  const clamped = Math.min(5, Math.max(1, rounded));
  return clamped as GoalProgress;
}

export function createNpcResponseFromLlmSchema(fallbackProgress: GoalProgress) {
  return z
    .object({
      npcMessage: z.string().trim().min(1).catch("..."),
      mood: moodFromUnknownSchema,
      goalStatus: goalStatusFromUnknownSchema,
      goalProgress: z.coerce
        .number()
        .transform((value) => clampGoalProgress(value, fallbackProgress))
        .catch(fallbackProgress),
      evaluation: npcEvaluationFromLlmSchema,
      hints: hintsFromUnknownSchema,
    })
    .catch({
      npcMessage: "...",
      mood: "neutral",
      goalStatus: "ongoing",
      goalProgress: fallbackProgress,
      evaluation: DEFAULT_NPC_EVALUATION,
      hints: [],
    });
}
