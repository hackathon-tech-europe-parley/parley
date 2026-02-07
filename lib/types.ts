import { z } from "zod";

// --- Zod Schemas ---

export const createConversationSchema = z.object({
  scenario: z.string().min(1),
  language: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  goal: z.string().min(1),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1),
});

// --- Interfaces ---

export interface ConversationMessage {
  role: "user" | "npc";
  text: string;
}

export interface Conversation {
  scenario: string;
  language: string;
  level: "beginner" | "intermediate" | "advanced";
  goal: string;
  npcName: string;
  npcPersonality: string;
  mood: string;
  history: ConversationMessage[];
  messagesSinceImageRegen: number;
  sceneImageUrl: string;
}

export interface NpcResponse {
  npcMessage: string;
  mood: string;
  goalStatus: "ongoing" | "achieved" | "failed";
  hints: string[];
}

export interface NpcProfile {
  name: string;
  personality: string;
}

export interface Debrief {
  narrative: string;
  keyPhrases: Array<{ phrase: string; translation: string }>;
  goalAchieved: boolean;
}

export interface ConversationSnapshot {
  conversationId: string;
  scenario: string;
  language: string;
  level: string;
  goal: string;
  npcName: string;
  mood: string;
  sceneImageUrl: string;
  history: ConversationMessage[];
  hints: string[];
}
