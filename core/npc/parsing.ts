import type { GoalProgress, GoalStatus } from "@/core/types";

function parseGoalProgress(
  value: unknown,
  fallback: GoalProgress | number,
): GoalProgress {
  const safeFallback = clampGoalProgress(fallback, 1);

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return safeFallback;
  }

  return clampGoalProgress(value, safeFallback);
}

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

export function resolveGoalProgress(
  status: GoalStatus,
  rawProgress: unknown,
  fallback: GoalProgress,
): GoalProgress {
  if (status === "achieved") {
    return 5;
  }
  if (status === "failed") {
    return 1;
  }
  return parseGoalProgress(rawProgress, fallback);
}
