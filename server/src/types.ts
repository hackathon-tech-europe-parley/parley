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
