import { z } from "zod";

// --- Zod Schemas ---

export const createConversationSchema = z.object({
  scenario: z.string().min(1),
  language: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced", "impossible"]),
  goal: z.string().min(1),
  scenarioKey: z.string().optional(),
  languageCode: z.string().optional(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1),
});

// --- Interfaces ---

export interface ConversationMessage {
  role: "user" | "npc";
  text: string;
}

export type ConversationLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "impossible";
export type GoalStatus = "ongoing" | "achieved" | "failed";
export type GoalProgress = 1 | 2 | 3 | 4 | 5;

export interface Conversation {
  scenario: string;
  language: string;
  level: ConversationLevel;
  goal: string;
  npcName: string;
  npcPersonality: string;
  mood: string;
  goalProgress: GoalProgress;
  hostilityStreak: number;
  disengagedStreak: number;
  constructiveStreak: number;
  history: ConversationMessage[];
  messagesSinceImageRegen: number;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  npcGender: NpcGender;
  scenarioKey?: string;
  languageCode?: string;
}

export interface NpcEvaluation {
  cooperation: number;
  relevance: number;
  politeness: number;
  clarity: number;
  taskIntent: number;
  offTopic: boolean;
  refusal: boolean;
  hostile: boolean;
}

export interface NpcResponse {
  npcMessage: string;
  mood: string;
  goalStatus: GoalStatus;
  goalProgress: GoalProgress;
  evaluation: NpcEvaluation;
  hints: string[];
}

export type NpcGender = "masculine" | "feminine";

export interface NpcProfile {
  name: string;
  personality: string;
  gender: NpcGender;
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
  goalProgress: GoalProgress;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  npcGender: NpcGender;
  history: ConversationMessage[];
  hints: string[];
  scenarioKey?: string;
  languageCode?: string;
}
