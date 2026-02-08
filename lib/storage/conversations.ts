import type { Conversation } from "../types";
import { DATABASE_URL } from "../env";

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
    if (rows.length === 0) return undefined;
    return rows[0].data as Conversation;
  }
  return globalStore.__parleyConversations!.get(id);
}

export async function setConversation(
  id: string,
  conversation: Conversation,
): Promise<void> {
  if (usePostgres) {
    const sql = getSQL();
    await sql`
      INSERT INTO conversations (id, data)
      VALUES (${id}, ${sql.json(conversation as never)})
      ON CONFLICT (id) DO UPDATE SET data = ${sql.json(conversation as never)}
    `;
    return;
  }
  globalStore.__parleyConversations!.set(id, conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  if (usePostgres) {
    const sql = getSQL();
    await sql`DELETE FROM conversations WHERE id = ${id}`;
    return;
  }
  globalStore.__parleyConversations!.delete(id);
  globalStore.__parleyReplySuggestions!.delete(id);
}

export async function getReplySuggestions(id: string): Promise<string[]> {
  if (usePostgres) {
    const sql = getSQL();
    const rows = await sql`SELECT reply_suggestions FROM conversations WHERE id = ${id}`;
    if (rows.length === 0) return [];
    return (rows[0].reply_suggestions as string[]) ?? [];
  }
  return globalStore.__parleyReplySuggestions!.get(id) ?? [];
}

export async function setReplySuggestions(
  id: string,
  suggestions: string[],
): Promise<void> {
  if (usePostgres) {
    const sql = getSQL();
    await sql`
      UPDATE conversations SET reply_suggestions = ${sql.json(suggestions)} WHERE id = ${id}
    `;
    return;
  }
  globalStore.__parleyReplySuggestions!.set(id, suggestions);
}

export function generateId(): string {
  return crypto.randomUUID();
}
