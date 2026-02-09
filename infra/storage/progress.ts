import { createLogger } from "@/core/logger";
import type { ProgressEntry } from "@/core/types";
import { getSQL, usePostgres } from "./db";

const log = createLogger("infra:storage:progress");

// --- In-memory fallback ---

const globalStore = globalThis as unknown as {
  __parleyProgress?: Map<string, ProgressEntry[]>;
};

if (!usePostgres) {
  if (!globalStore.__parleyProgress) {
    globalStore.__parleyProgress = new Map<string, ProgressEntry[]>();
  }
}

// --- Public API ---

export async function getProgress(sessionId: string): Promise<ProgressEntry[]> {
  if (usePostgres) {
    const sql = getSQL();
    const rows =
      await sql`SELECT data FROM progress WHERE session_id = ${sessionId} ORDER BY completed_at DESC`;
    return rows.map((r) => r.data as ProgressEntry);
  }
  return globalStore.__parleyProgress?.get(sessionId) ?? [];
}

export async function addProgressEntry(entry: ProgressEntry): Promise<void> {
  log.info(
    {
      scenarioKey: entry.scenarioKey,
      level: entry.level,
      goalAchieved: entry.goalAchieved,
    },
    "saving progress entry",
  );

  if (usePostgres) {
    const sql = getSQL();
    await sql`
      INSERT INTO progress (session_id, scenario_key, language_code, level, data, completed_at)
      VALUES (
        ${entry.sessionId},
        ${entry.scenarioKey},
        ${entry.languageCode},
        ${entry.level},
        ${sql.json(entry as never)},
        ${entry.completedAt}
      )
      ON CONFLICT (session_id, scenario_key, language_code, level)
      DO UPDATE SET data = ${sql.json(entry as never)}, completed_at = ${entry.completedAt}
    `;
    return;
  }

  const existing = globalStore.__parleyProgress?.get(entry.sessionId) ?? [];
  const idx = existing.findIndex(
    (e) =>
      e.scenarioKey === entry.scenarioKey &&
      e.languageCode === entry.languageCode &&
      e.level === entry.level,
  );
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.push(entry);
  }
  globalStore.__parleyProgress?.set(entry.sessionId, existing);
}
