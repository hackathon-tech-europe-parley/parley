import type {
  ConversationLevel,
  LanguageCode,
  ProgressEntry,
} from "@/core/types";

export type NodeStatus = "locked" | "available" | "completed" | "failed";

export interface LevelNodeState {
  level: ConversationLevel;
  status: NodeStatus;
  score?: number;
  turnsUsed?: number;
}

export interface ScenarioNodeState {
  scenarioKey: string;
  levels: LevelNodeState[];
}

const LEVEL_ORDER: ConversationLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "impossible",
];

export const FREE_SCENARIO_COUNT = 3;

export function computeUnlockedScenarioKeys(
  scenarioKeys: string[],
  languageCode: LanguageCode,
  entries: ProgressEntry[],
): Set<string> {
  const unlocked = new Set<string>();

  for (let i = 0; i < scenarioKeys.length; i++) {
    if (i < FREE_SCENARIO_COUNT) {
      unlocked.add(scenarioKeys[i]);
      continue;
    }
    const prevKey = scenarioKeys[i - 1];
    const prevBeginner = entries.find(
      (e) =>
        e.scenarioKey === prevKey &&
        e.languageCode === languageCode &&
        e.level === "beginner" &&
        e.goalAchieved,
    );
    if (prevBeginner) {
      unlocked.add(scenarioKeys[i]);
    } else {
      break;
    }
  }

  return unlocked;
}

export function computeScenarioProgress(
  scenarioKey: string,
  languageCode: LanguageCode,
  entries: ProgressEntry[],
): ScenarioNodeState {
  const relevant = entries.filter(
    (e) => e.scenarioKey === scenarioKey && e.languageCode === languageCode,
  );

  const entryMap = new Map<ConversationLevel, ProgressEntry>();
  for (const e of relevant) {
    entryMap.set(e.level, e);
  }

  const levels: LevelNodeState[] = LEVEL_ORDER.map((level, idx) => {
    const entry = entryMap.get(level);

    if (entry) {
      if (entry.goalAchieved) {
        return {
          level,
          status: "completed" as const,
          score: entry.objectiveScore,
          turnsUsed: entry.turnsUsed,
        };
      }
      // Attempted but not achieved — still available to retry
      return {
        level,
        status: "failed" as const,
        score: entry.objectiveScore,
        turnsUsed: entry.turnsUsed,
      };
    }

    // Not yet attempted
    if (idx === 0) {
      // Beginner is always available
      return { level, status: "available" as const };
    }

    // Check if previous level was completed
    const prevLevel = LEVEL_ORDER[idx - 1];
    const prevEntry = entryMap.get(prevLevel);
    if (prevEntry?.goalAchieved) {
      return { level, status: "available" as const };
    }

    return { level, status: "locked" as const };
  });

  return { scenarioKey, levels };
}
