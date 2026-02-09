import { z } from "zod";

/**
 * Simplified Zod schemas for the Vercel AI SDK's generateObject / streamObject.
 * These have NO .catch() / .transform() — AI SDK needs clean JSON-Schema-convertible schemas.
 * Post-validation safety net remains in lib/types/llm.ts (the existing .catch() schemas).
 */

export const npcProfileApiSchema = z.object({
  name: z.string().describe("A realistic local name for the NPC"),
  personality: z
    .string()
    .describe("2-3 sentence personality description of the NPC"),
  gender: z
    .enum(["masculine", "feminine"])
    .describe('Gender of the NPC, either "masculine" or "feminine"'),
});

export const npcResponseApiSchema = z.object({
  npcMessage: z
    .string()
    .describe("The NPC response message in the target language"),
  mood: z
    .string()
    .describe(
      "One of: happy, friendly, neutral, skeptical, annoyed, angry, sad, surprised",
    ),
  goalStatus: z
    .enum(["ongoing", "achieved", "failed"])
    .describe("Current status of the user goal"),
  goalProgress: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Goal progress from 1 (no progress) to 5 (completed)"),
  evaluation: z.object({
    cooperation: z.number().min(0).max(1),
    relevance: z.number().min(0).max(1),
    politeness: z.number().min(0).max(1),
    clarity: z.number().min(0).max(1),
    taskIntent: z.number().min(0).max(1),
    offTopic: z.boolean(),
    refusal: z.boolean(),
    hostile: z.boolean(),
  }),
  objective: z.object({
    objectiveScore: z.number().min(0).max(1),
    objectiveMet: z.boolean(),
    confidence: z.number().min(0).max(1),
    checkpoints: z.array(z.object({ id: z.string(), met: z.boolean() })),
    blockers: z.array(z.string()),
  }),
  safety: z.object({
    badWordsUsed: z.boolean(),
    tabooTopicUsed: z.boolean(),
  }),
  replySuggestions: z
    .array(z.string())
    .describe("Dialogue choices the user could pick as their next reply"),
  shouldCallPoliceman: z
    .boolean()
    .describe(
      "True only for severe hostility: repeated threats, extreme verbal abuse",
    ),
});

export const debriefApiSchema = z.object({
  narrative: z
    .string()
    .describe(
      "3-4 sentence story-style summary of how the conversation went, in English",
    ),
  keyPhrases: z.array(
    z.object({
      phrase: z.string().describe("Useful expression in the target language"),
      translation: z.string().describe("English translation"),
    }),
  ),
});

export const customScenarioApiSchema = z.object({
  title: z.string().describe("Short catchy title (2-4 words)"),
  description: z.string().describe("One-line description of the situation"),
  emoji: z.string().describe("A single emoji that represents the scenario"),
  scenario: z
    .string()
    .describe(
      "Full scenario description (2-3 sentences, second person, setting the scene)",
    ),
  goals: z.object({
    beginner: z
      .string()
      .describe("Simple, achievable goal using basic vocabulary"),
    intermediate: z
      .string()
      .describe("Moderately challenging goal requiring natural conversation"),
    advanced: z
      .string()
      .describe(
        "Demanding goal involving nuance, idioms, or complex negotiation",
      ),
    impossible: z
      .string()
      .describe(
        "Absurd, nearly unachievable goal that is humorous and over-the-top",
      ),
  }),
});
