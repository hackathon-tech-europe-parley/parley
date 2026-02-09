import { DATABASE_URL } from "../env";
import { createLogger } from "../logger";

const log = createLogger("storage:police-audio");
const usePostgres = Boolean(DATABASE_URL);

// --- Postgres backend (production) ---

// postgres uses `export = postgres` so we must use require() with verbatimModuleSyntax
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = usePostgres ? (require("postgres") as typeof import("postgres")) : null;

type SQL = import("postgres").Sql;

const globalWithSQL = globalThis as unknown as { __parleySQL?: SQL };

function getSQL(): SQL {
  if (!globalWithSQL.__parleySQL) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is required when Postgres mode is enabled");
    }
    globalWithSQL.__parleySQL = postgres!(DATABASE_URL);
  }
  return globalWithSQL.__parleySQL;
}

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
    const rows = await sql`SELECT audio_base64 FROM police_audio WHERE key = ${key}`;
    if (rows.length === 0) {
      log.debug({ key }, "police audio cache miss");
      return undefined;
    }
    log.debug({ key }, "police audio cache hit");
    return rows[0].audio_base64 as string;
  }
  const cached = globalStore.__parleyPoliceAudio!.get(key);
  log.debug({ key, hit: Boolean(cached) }, "police audio cache lookup");
  return cached;
}

export async function setPoliceAudio(key: string, audioBase64: string): Promise<void> {
  if (usePostgres) {
    const sql = getSQL();
    await sql`
      INSERT INTO police_audio (key, audio_base64)
      VALUES (${key}, ${audioBase64})
      ON CONFLICT (key) DO UPDATE SET audio_base64 = ${audioBase64}
    `;
    return;
  }
  globalStore.__parleyPoliceAudio!.set(key, audioBase64);
}
