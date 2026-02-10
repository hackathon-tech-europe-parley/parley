import { describe, expect, test } from "bun:test";
import {
  createNpcResponseFromLlmSchema,
  customScenarioFromLlmSchema,
  debriefFromLlmSchema,
  npcEvaluationFromLlmSchema,
  npcProfileFromLlmSchema,
  npcSafetyFromLlmSchema,
  objectiveAssessmentFromLlmSchema,
} from "./llm";

describe("npcEvaluationFromLlmSchema", () => {
  test("valid input parses correctly", () => {
    const result = npcEvaluationFromLlmSchema.parse({
      cooperation: 0.8,
      relevance: 0.7,
      politeness: 0.9,
      clarity: 0.6,
      taskIntent: 0.5,
      offTopic: false,
      refusal: false,
      hostile: false,
    });
    expect(result.cooperation).toBe(0.8);
    expect(result.hostile).toBe(false);
  });

  test("missing fields get defaults (0.5)", () => {
    const result = npcEvaluationFromLlmSchema.parse({
      cooperation: 0.8,
    });
    expect(result.cooperation).toBe(0.8);
    expect(result.relevance).toBe(0.5);
    expect(result.hostile).toBe(false);
  });

  test("totally invalid input returns full default object", () => {
    const result = npcEvaluationFromLlmSchema.parse("garbage");
    expect(result.cooperation).toBe(0.5);
    expect(result.relevance).toBe(0.5);
    expect(result.offTopic).toBe(false);
  });
});

describe("objectiveAssessmentFromLlmSchema", () => {
  test("objectiveMet: true bumps score to >= 0.9", () => {
    const result = objectiveAssessmentFromLlmSchema.parse({
      objectiveScore: 0.5,
      objectiveMet: true,
      confidence: 0.8,
      checkpoints: [],
      blockers: [],
    });
    expect(result.objectiveScore).toBeGreaterThanOrEqual(0.9);
  });

  test("invalid input returns default", () => {
    const result = objectiveAssessmentFromLlmSchema.parse(null);
    expect(result.objectiveScore).toBe(0.1);
    expect(result.objectiveMet).toBe(false);
  });
});

describe("npcSafetyFromLlmSchema", () => {
  test("aliased keys map to canonical fields", () => {
    const result = npcSafetyFromLlmSchema.parse({
      badLanguage: true,
      tabooTopic: true,
    });
    expect(result.badWordsUsed).toBe(true);
    expect(result.tabooTopicUsed).toBe(true);
  });

  test("profanity alias works", () => {
    const result = npcSafetyFromLlmSchema.parse({ profanity: true });
    expect(result.badWordsUsed).toBe(true);
  });

  test("toxicLanguage alias works", () => {
    const result = npcSafetyFromLlmSchema.parse({ toxicLanguage: true });
    expect(result.badWordsUsed).toBe(true);
  });
});

describe("npcProfileFromLlmSchema", () => {
  test("valid parse", () => {
    const result = npcProfileFromLlmSchema.parse({
      name: "Marie",
      personality: "Friendly baker",
      gender: "feminine",
    });
    expect(result.name).toBe("Marie");
  });

  test('missing name defaults to "NPC"', () => {
    const result = npcProfileFromLlmSchema.parse({
      personality: "Friendly",
      gender: "feminine",
    });
    expect(result.name).toBe("NPC");
  });

  test('invalid gender defaults to "feminine"', () => {
    const result = npcProfileFromLlmSchema.parse({
      name: "Test",
      personality: "Friendly",
      gender: "other",
    });
    expect(result.gender).toBe("feminine");
  });
});

describe("customScenarioFromLlmSchema", () => {
  test("valid parse preserves values", () => {
    const result = customScenarioFromLlmSchema.parse({
      title: "Coffee Shop",
      description: "Order a coffee",
      emoji: "☕",
      scenario: "You are in a coffee shop.",
      goals: {
        beginner: "Order a drink",
        intermediate: "Make small talk",
        advanced: "Negotiate a discount",
        impossible: "Become the barista",
      },
    });
    expect(result.title).toBe("Coffee Shop");
    expect(result.goals.beginner).toBe("Order a drink");
  });

  test("missing goals get default goals", () => {
    const result = customScenarioFromLlmSchema.parse({
      title: "Test",
      description: "Test",
      emoji: "🎭",
      scenario: "Test",
    });
    expect(result.goals.beginner).toBe("Introduce yourself politely.");
  });
});

describe("debriefFromLlmSchema", () => {
  test("filters out empty phrase/translation pairs", () => {
    const result = debriefFromLlmSchema.parse({
      narrative: "Good conversation.",
      keyPhrases: [
        { phrase: "bonjour", translation: "hello" },
        { phrase: "", translation: "empty" },
        { phrase: "merci", translation: "" },
      ],
    });
    expect(result.keyPhrases).toHaveLength(1);
    expect(result.keyPhrases[0].phrase).toBe("bonjour");
  });

  test("garbage input returns default", () => {
    const result = debriefFromLlmSchema.parse(42);
    expect(result.narrative).toBe("The conversation has ended.");
    expect(result.keyPhrases).toHaveLength(0);
  });
});

describe("createNpcResponseFromLlmSchema", () => {
  test("complete fallback on garbage input", () => {
    const schema = createNpcResponseFromLlmSchema(2);
    const result = schema.parse("garbage");
    expect(result.npcMessage).toBe("...");
    expect(result.goalProgress).toBe(2);
    expect(result.goalStatus).toBe("ongoing");
  });

  test("goalProgress is clamped to 1-5", () => {
    const schema = createNpcResponseFromLlmSchema(1);
    const result = schema.parse({
      npcMessage: "Hello",
      mood: "neutral",
      goalStatus: "ongoing",
      goalProgress: 10,
      evaluation: {},
      objective: {},
      safety: {},
      replySuggestions: [],
      shouldCallPoliceman: false,
    });
    expect(result.goalProgress).toBe(5);
  });
});
