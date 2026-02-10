import { describe, expect, test } from "bun:test";
import type { ProgressEntry } from "@/core/types/models";
import {
  computeScenarioProgress,
  computeUnlockedScenarioKeys,
  FREE_SCENARIO_COUNT,
} from "./unlock";

const SCENARIOS = ["cafe", "market", "hotel", "airport", "museum"];

function makeEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  return {
    sessionId: "s1",
    scenarioKey: "cafe",
    languageCode: "en",
    level: "beginner",
    goalAchieved: true,
    objectiveScore: 0.85,
    turnsUsed: 5,
    completedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeUnlockedScenarioKeys", () => {
  test("first 3 scenarios are always unlocked", () => {
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", []);
    expect(unlocked.size).toBe(FREE_SCENARIO_COUNT);
    expect(unlocked.has("cafe")).toBe(true);
    expect(unlocked.has("market")).toBe(true);
    expect(unlocked.has("hotel")).toBe(true);
  });

  test("4th scenario locked if 3rd beginner not completed", () => {
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", []);
    expect(unlocked.has("airport")).toBe(false);
  });

  test("4th scenario unlocked if 3rd beginner completed", () => {
    const entries = [makeEntry({ scenarioKey: "hotel", languageCode: "en" })];
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", entries);
    expect(unlocked.has("airport")).toBe(true);
  });

  test("5th scenario requires 4th beginner completed", () => {
    const entries = [makeEntry({ scenarioKey: "hotel", languageCode: "en" })];
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", entries);
    expect(unlocked.has("museum")).toBe(false);
  });

  test("chain unlocking works", () => {
    const entries = [
      makeEntry({ scenarioKey: "hotel", languageCode: "en" }),
      makeEntry({ scenarioKey: "airport", languageCode: "en" }),
    ];
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", entries);
    expect(unlocked.has("museum")).toBe(true);
  });

  test("different language entries don't count", () => {
    const entries = [makeEntry({ scenarioKey: "hotel", languageCode: "fr" })];
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", entries);
    expect(unlocked.has("airport")).toBe(false);
  });

  test("failed beginner doesn't unlock next", () => {
    const entries = [
      makeEntry({
        scenarioKey: "hotel",
        languageCode: "en",
        goalAchieved: false,
      }),
    ];
    const unlocked = computeUnlockedScenarioKeys(SCENARIOS, "en", entries);
    expect(unlocked.has("airport")).toBe(false);
  });
});

describe("computeScenarioProgress", () => {
  test("beginner is always available", () => {
    const progress = computeScenarioProgress("cafe", "en", []);
    expect(progress.levels[0].level).toBe("beginner");
    expect(progress.levels[0].status).toBe("available");
  });

  test("intermediate locked if beginner not completed", () => {
    const progress = computeScenarioProgress("cafe", "en", []);
    expect(progress.levels[1].status).toBe("locked");
  });

  test("completed level shows score and turnsUsed", () => {
    const entries = [
      makeEntry({
        scenarioKey: "cafe",
        objectiveScore: 0.9,
        turnsUsed: 8,
      }),
    ];
    const progress = computeScenarioProgress("cafe", "en", entries);
    expect(progress.levels[0].status).toBe("completed");
    expect(progress.levels[0].score).toBe(0.9);
    expect(progress.levels[0].turnsUsed).toBe(8);
  });

  test("failed level shows failed status", () => {
    const entries = [
      makeEntry({
        scenarioKey: "cafe",
        goalAchieved: false,
        objectiveScore: 0.3,
      }),
    ];
    const progress = computeScenarioProgress("cafe", "en", entries);
    expect(progress.levels[0].status).toBe("failed");
  });

  test("completing beginner unlocks intermediate", () => {
    const entries = [makeEntry({ scenarioKey: "cafe" })];
    const progress = computeScenarioProgress("cafe", "en", entries);
    expect(progress.levels[1].status).toBe("available");
  });
});
