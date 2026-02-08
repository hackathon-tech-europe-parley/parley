import { z } from "zod";
import type { GoalProgress } from "./constants";
import type {
  NpcEvaluation,
  ObjectiveAssessment,
  NpcSafetyAssessment,
} from "./models";
import { goalStatusSchema, npcGenderSchema } from "./schemas";

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

const DEFAULT_OBJECTIVE_ASSESSMENT: ObjectiveAssessment = {
  objectiveScore: 0.1,
  objectiveMet: false,
  confidence: 0.5,
  checkpoints: [],
  blockers: [],
};

const DEFAULT_NPC_SAFETY_ASSESSMENT: NpcSafetyAssessment = {
  badWordsUsed: false,
  tabooTopicUsed: false,
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

const replySuggestionsFromUnknownSchema = z
  .array(z.string())
  .transform((suggestions) => suggestions.map((s) => s.trim()).filter(Boolean))
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

export const objectiveAssessmentFromLlmSchema = z
  .object({
    objectiveScore: unitScoreFromUnknownSchema.catch(0.1),
    objectiveMet: booleanFromUnknownSchema.catch(false),
    confidence: unitScoreFromUnknownSchema.catch(0.5),
    checkpoints: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).catch("checkpoint"),
            met: booleanFromUnknownSchema.catch(false),
          })
          .transform((value) => ({
            id: value.id,
            met: value.met,
          })),
      )
      .catch([]),
    blockers: z
      .array(z.string())
      .transform((blockers) =>
        blockers.map((value) => value.trim()).filter(Boolean),
      )
      .catch([]),
  })
  .transform((value) => ({
    ...value,
    objectiveScore: value.objectiveMet
      ? Math.max(value.objectiveScore, 0.9)
      : value.objectiveScore,
  }))
  .catch(DEFAULT_OBJECTIVE_ASSESSMENT);

export const npcSafetyFromLlmSchema = z
  .preprocess((raw) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const candidate = raw as Record<string, unknown>;
      return {
        badWordsUsed:
          candidate.badWordsUsed ??
          candidate.badLanguage ??
          candidate.toxicLanguage ??
          candidate.profanity ??
          candidate.insultDetected ??
          false,
        tabooTopicUsed:
          candidate.tabooTopicUsed ??
          candidate.tabooTopic ??
          candidate.disallowedTopic ??
          candidate.forbiddenTopic ??
          candidate.sensitiveTopic ??
          false,
      };
    }
    return raw;
  }, z.object({
    badWordsUsed: booleanFromUnknownSchema.catch(false),
    tabooTopicUsed: booleanFromUnknownSchema.catch(false),
  }))
  .catch(DEFAULT_NPC_SAFETY_ASSESSMENT);

export const npcProfileFromLlmSchema = z
  .object({
    name: z.string().trim().min(1).catch("NPC"),
    personality: z.string().trim().min(1).catch("Neutral personality."),
    gender: npcGenderSchema.catch("feminine"),
  })
  .catch({
    name: "NPC",
    personality: "Neutral personality.",
    gender: "feminine",
  });

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
        values.filter(
          (value) =>
            value.phrase.length > 0 && value.translation.length > 0,
        ),
      )
      .catch([]),
  })
  .catch({ narrative: "The conversation has ended.", keyPhrases: [] });

function clampGoalProgress(
  value: number,
  fallback: GoalProgress,
): GoalProgress {
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
      objective: objectiveAssessmentFromLlmSchema,
      safety: npcSafetyFromLlmSchema,
      replySuggestions: replySuggestionsFromUnknownSchema,
      shouldCallPoliceman: booleanFromUnknownSchema.catch(false),
    })
    .catch({
      npcMessage: "...",
      mood: "neutral",
      goalStatus: "ongoing",
      goalProgress: fallbackProgress,
      evaluation: DEFAULT_NPC_EVALUATION,
      objective: DEFAULT_OBJECTIVE_ASSESSMENT,
      safety: DEFAULT_NPC_SAFETY_ASSESSMENT,
      replySuggestions: [],
      shouldCallPoliceman: false,
    });
}
