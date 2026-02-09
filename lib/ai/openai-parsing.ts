import type { GoalProgress, GoalStatus } from "../types";
import { createLogger } from "../logger";

const log = createLogger("ai:parsing");

export function parseJsonSafely(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    log.warn("JSON parse failed, returning empty object");
    return {};
  }
}

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

export function extractPartialNpcMessage(partial: string): string | null {
  const key = '"npcMessage"';
  const keyIndex = partial.indexOf(key);
  if (keyIndex === -1) {
    return null;
  }

  const afterKey = partial.slice(keyIndex + key.length);
  const colonIndex = afterKey.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }

  const afterColon = afterKey.slice(colonIndex + 1).trimStart();
  if (!afterColon.startsWith('"')) {
    return null;
  }

  let result = "";
  let i = 1;
  while (i < afterColon.length) {
    const ch = afterColon[i];
    if (ch === "\\") {
      if (i + 1 < afterColon.length) {
        const next = afterColon[i + 1];
        if (next === '"') {
          result += '"';
        } else if (next === "\\") {
          result += "\\";
        } else if (next === "n") {
          result += "\n";
        } else if (next === "t") {
          result += "\t";
        } else if (next === "r") {
          result += "\r";
        } else {
          result += next;
        }
        i += 2;
        continue;
      }
      break;
    }
    if (ch === '"') {
      break;
    }
    result += ch;
    i++;
  }

  return result || null;
}
