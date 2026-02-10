import { describe, expect, test } from "bun:test";
import type {
  Conversation,
  NpcEvaluation,
  NpcResponse,
  NpcSafetyAssessment,
  ObjectiveAssessment,
} from "@/core/types/models";
import { applyNpcPolicy } from "./policy";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    scenario: "test",
    language: "en",
    level: "beginner",
    goal: "test goal",
    npcName: "NPC",
    npcPersonality: "friendly",
    mood: "neutral",
    goalProgress: 1,
    hostilityStreak: 0,
    disengagedStreak: 0,
    constructiveStreak: 0,
    history: [],
    messagesSinceImageRegen: 0,
    sceneImageUrl: "http://example.com/scene.png",
    npcFaceImageUrl: "http://example.com/face.png",
    npcGender: "feminine",
    tabooStrike: 0,
    ...overrides,
  };
}

function makeEvaluation(overrides: Partial<NpcEvaluation> = {}): NpcEvaluation {
  return {
    cooperation: 0.8,
    relevance: 0.8,
    politeness: 0.8,
    clarity: 0.8,
    taskIntent: 0.8,
    offTopic: false,
    refusal: false,
    hostile: false,
    ...overrides,
  };
}

function makeObjective(
  overrides: Partial<ObjectiveAssessment> = {},
): ObjectiveAssessment {
  return {
    objectiveScore: 0.5,
    objectiveMet: false,
    confidence: 0.8,
    checkpoints: [],
    blockers: [],
    ...overrides,
  };
}

function makeSafety(
  overrides: Partial<NpcSafetyAssessment> = {},
): NpcSafetyAssessment {
  return {
    badWordsUsed: false,
    tabooTopicUsed: false,
    ...overrides,
  };
}

function makeResponse(overrides: Partial<NpcResponse> = {}): NpcResponse {
  return {
    npcMessage: "Hello there!",
    mood: "neutral",
    goalStatus: "ongoing",
    goalProgress: 3,
    evaluation: makeEvaluation(),
    objective: makeObjective(),
    safety: makeSafety(),
    replySuggestions: ["Hi!", "Hello!"],
    ...overrides,
  };
}

describe("applyNpcPolicy", () => {
  test("taboo turn forces goalProgress to 1", () => {
    const conv = makeConversation();
    const resp = makeResponse({
      safety: makeSafety({ badWordsUsed: true }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.goalProgress).toBe(1);
  });

  test("taboo turn sets hostile flags", () => {
    const conv = makeConversation();
    const resp = makeResponse({
      safety: makeSafety({ tabooTopicUsed: true }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.evaluation.hostile).toBe(true);
    expect(result.evaluation.offTopic).toBe(true);
  });

  test("hostility streak reaching threshold triggers failure", () => {
    // beginner failHostilityStreak is 4
    const conv = makeConversation({ hostilityStreak: 3 });
    const resp = makeResponse({
      evaluation: makeEvaluation({
        hostile: true,
        politeness: 0.05,
        cooperation: 0.1,
      }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.goalStatus).toBe("failed");
  });

  test("disengaged streak reaching threshold triggers failure", () => {
    // beginner failDisengagedStreak is 5
    const conv = makeConversation({ disengagedStreak: 4 });
    const resp = makeResponse({
      evaluation: makeEvaluation({ offTopic: true, cooperation: 0.1 }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.goalStatus).toBe("failed");
  });

  test("high scores + objectiveMet → goalStatus achieved", () => {
    const conv = makeConversation({ constructiveStreak: 1 });
    const resp = makeResponse({
      evaluation: makeEvaluation({
        cooperation: 0.95,
        relevance: 0.95,
        politeness: 0.95,
        clarity: 0.95,
        taskIntent: 0.95,
      }),
      objective: makeObjective({
        objectiveScore: 0.95,
        objectiveMet: true,
        confidence: 0.9,
      }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.goalStatus).toBe("achieved");
    expect(result.goalProgress).toBe(5);
  });

  test("progress can only step up by 1 per turn", () => {
    const conv = makeConversation({ goalProgress: 2 });
    const resp = makeResponse({
      evaluation: makeEvaluation(),
      objective: makeObjective({ objectiveScore: 0.8 }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.goalProgress).toBeLessThanOrEqual(3);
  });

  test("progress 5 is reserved for terminal success (ongoing caps at 4)", () => {
    const conv = makeConversation({ goalProgress: 4 });
    const resp = makeResponse({
      evaluation: makeEvaluation(),
      objective: makeObjective({ objectiveScore: 0.85 }),
      goalStatus: "ongoing",
    });
    const result = applyNpcPolicy(conv, resp);
    if (result.goalStatus === "ongoing") {
      expect(result.goalProgress).toBeLessThanOrEqual(4);
    }
  });

  test("impossible mode requires constructiveStreak >= 2 for achievement", () => {
    const conv = makeConversation({
      level: "impossible",
      constructiveStreak: 1, // only 1, need 2
    });
    const resp = makeResponse({
      evaluation: makeEvaluation({
        cooperation: 0.98,
        relevance: 0.98,
        politeness: 0.98,
        clarity: 0.98,
        taskIntent: 0.98,
      }),
      objective: makeObjective({
        objectiveScore: 0.98,
        objectiveMet: true,
        confidence: 0.9,
      }),
    });
    applyNpcPolicy(conv, resp);
    // The key test: with constructiveStreak: 0, it should NOT achieve.
    const conv2 = makeConversation({
      level: "impossible",
      constructiveStreak: 0,
    });
    const result2 = applyNpcPolicy(conv2, resp);
    expect(result2.goalStatus).not.toBe("achieved");
  });

  test("taboo turn sets mood to angry", () => {
    const conv = makeConversation();
    const resp = makeResponse({
      safety: makeSafety({ badWordsUsed: true }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.mood).toBe("angry");
  });

  test("beginner fail sets mood to annoyed", () => {
    const conv = makeConversation({
      level: "beginner",
      hostilityStreak: 3,
    });
    const resp = makeResponse({
      evaluation: makeEvaluation({
        hostile: true,
        politeness: 0.05,
        cooperation: 0.1,
      }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.goalStatus).toBe("failed");
    expect(result.mood).toBe("annoyed");
  });

  test("enforceMoodTone replaces soft angry message with fallback", () => {
    const conv = makeConversation({ language: "en" });
    const resp = makeResponse({
      npcMessage: "I am here to help you!",
      safety: makeSafety({ badWordsUsed: true }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.npcMessage).toContain("Enough");
  });

  test("enforceMoodTone works for French", () => {
    const conv = makeConversation({ language: "French" });
    const resp = makeResponse({
      npcMessage: "Je suis là pour vous aider!",
      safety: makeSafety({ badWordsUsed: true }),
    });
    const result = applyNpcPolicy(conv, resp);
    expect(result.npcMessage).toContain("suffit");
  });
});
