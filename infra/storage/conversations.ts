import { createLogger } from "@/core/logger";
import type { Conversation } from "@/core/types";
import { getSQL, usePostgres } from "./db";

const log = createLogger("infra:storage:conversations");

// --- In-memory fallback (local dev without DATABASE_URL) ---

const globalStore = globalThis as unknown as {
  __parleyConversations?: Map<string, Conversation>;
  __parleyReplySuggestions?: Map<string, string[]>;
};

if (!usePostgres) {
  if (!globalStore.__parleyConversations) {
    globalStore.__parleyConversations = new Map<string, Conversation>();
  }
  if (!globalStore.__parleyReplySuggestions) {
    globalStore.__parleyReplySuggestions = new Map<string, string[]>();
  }
}

// --- Public API (all async except generateId) ---

export async function getConversation(
  id: string,
): Promise<Conversation | undefined> {
  if (usePostgres) {
    const sql = getSQL();
    const rows = await sql`SELECT data FROM conversations WHERE id = ${id}`;
    if (rows.length === 0) {
      log.debug("conversation not found (postgres)");
      return undefined;
    }
    return rows[0].data as Conversation;
  }
  const result = globalStore.__parleyConversations?.get(id);
  if (!result) {
    log.debug("conversation not found (memory)");
  }
  return result;
}

export async function setConversation(
  id: string,
  conversation: Conversation,
): Promise<void> {
  log.debug(
    { backend: usePostgres ? "postgres" : "memory" },
    "saving conversation",
  );
  if (usePostgres) {
    const sql = getSQL();
    await sql`
      INSERT INTO conversations (id, data)
      VALUES (${id}, ${sql.json(conversation as never)})
      ON CONFLICT (id) DO UPDATE SET data = ${sql.json(conversation as never)}
    `;
    return;
  }
  globalStore.__parleyConversations?.set(id, conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  log.debug(
    { backend: usePostgres ? "postgres" : "memory" },
    "deleting conversation",
  );
  if (usePostgres) {
    const sql = getSQL();
    await sql`DELETE FROM conversations WHERE id = ${id}`;
    return;
  }
  globalStore.__parleyConversations?.delete(id);
  globalStore.__parleyReplySuggestions?.delete(id);
}

export async function getReplySuggestions(id: string): Promise<string[]> {
  if (usePostgres) {
    const sql = getSQL();
    const rows =
      await sql`SELECT data->'replySuggestions' AS suggestions FROM conversations WHERE id = ${id}`;
    if (rows.length === 0) return [];
    return (rows[0].suggestions as string[]) ?? [];
  }
  return globalStore.__parleyReplySuggestions?.get(id) ?? [];
}

export async function setReplySuggestions(
  id: string,
  suggestions: string[],
): Promise<void> {
  if (usePostgres) {
    const sql = getSQL();
    await sql`
      UPDATE conversations SET data = jsonb_set(data, '{replySuggestions}', ${sql.json(suggestions)}) WHERE id = ${id}
    `;
    return;
  }
  globalStore.__parleyReplySuggestions?.set(id, suggestions);
}

export function generateId(): string {
  return crypto.randomUUID();
}
