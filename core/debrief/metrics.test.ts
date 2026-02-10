import { describe, expect, test } from "bun:test";
import type { Conversation, NpcEvaluation } from "@/core/types/models";
import { buildDebriefMetrics } from "./metrics";

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
    evaluationHistory: [],
    objectiveHistory: [],
    ...overrides,
  };
}

function makeEvaluation(overrides: Partial<NpcEvaluation> = {}): NpcEvaluation {
  return {
    cooperation: 0.7,
    relevance: 0.7,
    politeness: 0.7,
    clarity: 0.7,
    taskIntent: 0.7,
    offTopic: false,
    refusal: false,
    hostile: false,
    ...overrides,
  };
}

describe("buildDebriefMetrics", () => {
  test("empty histories produce zero averages", () => {
    const conv = makeConversation();
    const metrics = buildDebriefMetrics(conv, "quit");
    expect(metrics.evaluationAverages.cooperation).toBe(0);
    expect(metrics.evaluationAverages.relevance).toBe(0);
    expect(metrics.turnsAnalyzed).toBe(0);
  });

  test("single evaluation returns that evaluation's values", () => {
    const eval1 = makeEvaluation({ cooperation: 0.8, relevance: 0.6 });
    const conv = makeConversation({ evaluationHistory: [eval1] });
    const metrics = buildDebriefMetrics(conv, "quit");
    expect(metrics.evaluationAverages.cooperation).toBe(0.8);
    expect(metrics.evaluationAverages.relevance).toBe(0.6);
  });

  test("multiple evaluations produce correct averages", () => {
    const evals = [
      makeEvaluation({ cooperation: 0.6 }),
      makeEvaluation({ cooperation: 0.8 }),
    ];
    const conv = makeConversation({ evaluationHistory: evals });
    const metrics = buildDebriefMetrics(conv, "quit");
    expect(metrics.evaluationAverages.cooperation).toBe(0.7);
  });

  test('finalStatus "achieved" sets objective.met to true', () => {
    const conv = makeConversation();
    const metrics = buildDebriefMetrics(conv, "achieved");
    expect(metrics.objective.met).toBe(true);
  });

  test('finalStatus "failed" includes conversation_failed blocker', () => {
    const conv = makeConversation();
    const metrics = buildDebriefMetrics(conv, "failed");
    expect(metrics.objective.blockers).toContain("conversation_failed");
  });

  test('finalStatus "quit" includes user_quit blocker', () => {
    const conv = makeConversation();
    const metrics = buildDebriefMetrics(conv, "quit");
    expect(metrics.objective.blockers).toContain("user_quit");
  });

  test("progressToObjectiveScore mapping", () => {
    // goalProgress 1 → score 0, 3 → 0.5, 5 → 1
    const conv1 = makeConversation({ goalProgress: 1 });
    expect(buildDebriefMetrics(conv1, "quit").objective.score).toBe(0);

    const conv3 = makeConversation({ goalProgress: 3 });
    expect(buildDebriefMetrics(conv3, "quit").objective.score).toBe(0.5);

    const conv5 = makeConversation({ goalProgress: 5 });
    expect(buildDebriefMetrics(conv5, "quit").objective.score).toBe(1);
  });

  test("deduplicates blockers", () => {
    const conv = makeConversation({
      objectiveHistory: [
        {
          objectiveScore: 0.3,
          objectiveMet: false,
          confidence: 0.5,
          checkpoints: [],
          blockers: ["user_quit", "some_blocker"],
        },
      ],
    });
    const metrics = buildDebriefMetrics(conv, "quit");
    const quitCount = metrics.objective.blockers.filter(
      (b) => b === "user_quit",
    ).length;
    expect(quitCount).toBe(1);
  });

  test("NaN scores are clamped to 0", () => {
    const eval1 = makeEvaluation({ cooperation: Number.NaN });
    const conv = makeConversation({ evaluationHistory: [eval1] });
    const metrics = buildDebriefMetrics(conv, "quit");
    expect(metrics.evaluationAverages.cooperation).toBe(0);
  });

  test("scores > 1 are clamped to 1", () => {
    const eval1 = makeEvaluation({ cooperation: 1.5 });
    const conv = makeConversation({ evaluationHistory: [eval1] });
    const metrics = buildDebriefMetrics(conv, "quit");
    expect(metrics.evaluationAverages.cooperation).toBe(1);
  });
});
