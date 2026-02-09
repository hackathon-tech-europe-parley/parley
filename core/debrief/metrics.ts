import type { Conversation, Debrief, NpcEvaluation } from "@/core/types";

export function buildDebriefMetrics(
  conversation: Conversation,
  finalStatus: "achieved" | "failed" | "quit",
): NonNullable<Debrief["metrics"]> {
  const evaluationHistory = conversation.evaluationHistory ?? [];
  const objectiveHistory = conversation.objectiveHistory ?? [];
  const lastObjective = objectiveHistory[objectiveHistory.length - 1];

  return {
    turnsAnalyzed: Math.max(evaluationHistory.length, objectiveHistory.length),
    evaluationAverages: {
      cooperation: averageEvaluationMetric(evaluationHistory, "cooperation"),
      relevance: averageEvaluationMetric(evaluationHistory, "relevance"),
      politeness: averageEvaluationMetric(evaluationHistory, "politeness"),
      clarity: averageEvaluationMetric(evaluationHistory, "clarity"),
      taskIntent: averageEvaluationMetric(evaluationHistory, "taskIntent"),
    },
    objective: {
      score: clampUnit(
        lastObjective?.objectiveScore ??
          progressToObjectiveScore(conversation.goalProgress),
      ),
      confidence: clampUnit(lastObjective?.confidence ?? 0.5),
      met: finalStatus === "achieved" || Boolean(lastObjective?.objectiveMet),
      checkpoints: lastObjective?.checkpoints ?? [],
      blockers: dedupeStrings([
        ...(lastObjective?.blockers ?? []),
        ...(finalStatus === "failed" ? ["conversation_failed"] : []),
        ...(finalStatus === "quit" ? ["user_quit"] : []),
      ]),
    },
  };
}

function averageEvaluationMetric(
  history: NpcEvaluation[],
  key: keyof Pick<
    NpcEvaluation,
    "cooperation" | "relevance" | "politeness" | "clarity" | "taskIntent"
  >,
): number {
  if (history.length === 0) {
    return 0;
  }
  const total = history.reduce((sum, item) => sum + clampUnit(item[key]), 0);
  return roundToHundredth(total / history.length);
}

function progressToObjectiveScore(progress: number): number {
  const normalized = Number.isFinite(progress) ? Math.round(progress) : 1;
  const clamped = Math.min(5, Math.max(1, normalized));
  return roundToHundredth((clamped - 1) / 4);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function roundToHundredth(value: number): number {
  return Math.round(clampUnit(value) * 100) / 100;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
