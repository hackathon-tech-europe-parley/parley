import type { Conversation } from "./types";

// Survive Next.js dev hot reloads by attaching to globalThis
const globalStore = globalThis as unknown as {
  __parleyConversations?: Map<string, Conversation>;
  __parleyHints?: Map<string, string[]>;
};

if (!globalStore.__parleyConversations) {
  globalStore.__parleyConversations = new Map<string, Conversation>();
}
if (!globalStore.__parleyHints) {
  globalStore.__parleyHints = new Map<string, string[]>();
}

const conversations = globalStore.__parleyConversations;
const hintsStore = globalStore.__parleyHints;

export function getConversation(id: string): Conversation | undefined {
  return conversations.get(id);
}

export function setConversation(id: string, conversation: Conversation): void {
  conversations.set(id, conversation);
}

export function deleteConversation(id: string): void {
  conversations.delete(id);
  hintsStore.delete(id);
}

export function getHints(id: string): string[] {
  return hintsStore.get(id) ?? [];
}

export function setHints(id: string, hints: string[]): void {
  hintsStore.set(id, hints);
}

export function generateId(): string {
  return crypto.randomUUID();
}
