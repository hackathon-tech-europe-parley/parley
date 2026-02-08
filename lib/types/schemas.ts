import { z } from "zod";
import {
  CONVERSATION_LEVELS,
  CONVERSATION_ROLES,
  GOAL_STATUSES,
  LANGUAGE_CODES,
  NPC_GENDERS,
  type GoalProgress,
} from "./constants";

export const languageCodeSchema = z.enum(LANGUAGE_CODES);
export const npcGenderSchema = z.enum(NPC_GENDERS);
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
    mood: nonEmptyStringSchema.optional(),
    npcFaceImageUrl: z.string().optional(),
    speakerName: nonEmptyStringSchema.optional(),
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
    npcGender: npcGenderSchema.optional(),
    speed: z.number().min(0.5).max(2.0).optional(),
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
    gender: npcGenderSchema,
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
    npcGender: npcGenderSchema,
    scenarioKey: nonEmptyStringSchema.optional(),
    languageCode: languageCodeSchema.optional(),
    specialPerson: z
      .object({
        name: nonEmptyStringSchema,
        type: nonEmptyStringSchema,
        mood: nonEmptyStringSchema,
        faceImageUrl: nonEmptyStringSchema,
      })
      .optional(),
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
    npcGender: npcGenderSchema,
    history: z.array(conversationMessageSchema),
    hints: z.array(nonEmptyStringSchema),
    scenarioKey: nonEmptyStringSchema.optional(),
    languageCode: languageCodeSchema.optional(),
    specialPerson: z
      .object({
        name: nonEmptyStringSchema,
        type: nonEmptyStringSchema,
        mood: nonEmptyStringSchema,
        faceImageUrl: nonEmptyStringSchema,
      })
      .optional(),
  })
  .strict();

export const createConversationResponseSchema = z
  .object({
    conversationId: idParamSchema,
    sceneImageUrl: nonEmptyStringSchema,
    npcFaceImageUrl: z.string(),
    npcName: nonEmptyStringSchema,
    npcGender: npcGenderSchema,
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
    speakerName: nonEmptyStringSchema.optional(),
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
