import {
  conversationCacheSchema,
  type ConversationLevel,
  type ConversationMessage,
  type Debrief,
  type GoalProgress,
  type LanguageCode,
  type NpcGender,
} from "@/lib/types";

export interface ConversationState {
  conversationId: string;
  scenario: string;
  language: string;
  level: ConversationLevel;
  goal: string;
  npcName: string;
  npcGender?: NpcGender;
  mood: string;
  goalProgress: GoalProgress;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  history: ConversationMessage[];
  hints: string[];
  scenarioKey?: string;
  languageCode?: LanguageCode;
  specialPerson?: {
    name: string;
    type: string;
    mood: string;
    faceImageUrl: string;
  };
}

export interface DebriefState {
  debrief: Debrief;
  sceneImageUrl: string;
  npcName: string;
  goalStatus: string;
}

export function fromCachedConversation(
  cached: ReturnType<typeof conversationCacheSchema.parse>,
): ConversationState {
  return {
    conversationId: cached.conversationId,
    scenario: cached.scenario,
    language: cached.language,
    level: cached.level,
    goal: cached.goal,
    npcName: cached.npcName,
    npcGender: cached.npcGender,
    mood: cached.npcOpeningMood,
    goalProgress: cached.npcOpeningGoalProgress,
    sceneImageUrl: cached.sceneImageUrl,
    npcFaceImageUrl: cached.npcFaceImageUrl,
    history: [{
      role: "npc",
      text: cached.npcOpeningMessage,
      mood: cached.npcOpeningMood,
      npcFaceImageUrl: cached.npcFaceImageUrl,
    }],
    hints: cached.hints,
    scenarioKey: cached.scenarioKey,
    languageCode: cached.languageCode,
  };
}
