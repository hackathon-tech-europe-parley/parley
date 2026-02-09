import { createLogger } from "@/core/logger";
import { getSQL, usePostgres } from "./db";

const log = createLogger("infra:storage:police-audio");

// --- In-memory fallback (local dev without DATABASE_URL) ---

const globalStore = globalThis as unknown as {
  __parleyPoliceAudio?: Map<string, string>;
};

if (!usePostgres) {
  if (!globalStore.__parleyPoliceAudio) {
    globalStore.__parleyPoliceAudio = new Map<string, string>();
  }
}

// --- Public API ---

export async function getPoliceAudio(key: string): Promise<string | undefined> {
  if (usePostgres) {
    const sql = getSQL();
    const rows =
      await sql`SELECT audio_base64 FROM police_audio WHERE key = ${key}`;
    if (rows.length === 0) {
      log.debug({ key }, "police audio cache miss");
      return undefined;
    }
    log.debug({ key }, "police audio cache hit");
    return rows[0].audio_base64 as string;
  }
  const cached = globalStore.__parleyPoliceAudio?.get(key);
  log.debug({ key, hit: Boolean(cached) }, "police audio cache lookup");
  return cached;
}

export async function setPoliceAudio(
  key: string,
  audioBase64: string,
): Promise<void> {
  if (usePostgres) {
    const sql = getSQL();
    await sql`
      INSERT INTO police_audio (key, audio_base64)
      VALUES (${key}, ${audioBase64})
      ON CONFLICT (key) DO UPDATE SET audio_base64 = ${audioBase64}
    `;
    return;
  }
  globalStore.__parleyPoliceAudio?.set(key, audioBase64);
}
