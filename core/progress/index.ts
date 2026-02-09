import type {
  Conversation,
  ConversationLevel,
  LanguageCode,
  ProgressEntry,
} from "@/core/types";

export function buildProgressEntry(
  sessionId: string,
  conversation: Conversation,
): ProgressEntry {
  const lastObjective = conversation.objectiveHistory?.at(-1) ?? null;

  return {
    sessionId,
    scenarioKey: conversation.scenarioKey ?? "__unknown__",
    languageCode: (conversation.languageCode ?? "en") as LanguageCode,
    level: conversation.level as ConversationLevel,
    goalAchieved: conversation.debrief?.goalAchieved ?? false,
    objectiveScore: lastObjective?.objectiveScore ?? 0,
    turnsUsed: conversation.turnCount ?? conversation.history.length,
    completedAt: new Date().toISOString(),
  };
}

export type { LevelNodeState, NodeStatus, ScenarioNodeState } from "./unlock";
export {
  computeScenarioProgress,
  computeUnlockedScenarioKeys,
  FREE_SCENARIO_COUNT,
} from "./unlock";
