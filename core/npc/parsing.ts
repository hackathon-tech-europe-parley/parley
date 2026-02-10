import { match } from "ts-pattern";
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
  return match(status)
    .with("achieved", () => 5 as GoalProgress)
    .with("failed", () => 1 as GoalProgress)
    .with("ongoing", () => parseGoalProgress(rawProgress, fallback))
    .exhaustive();
}
