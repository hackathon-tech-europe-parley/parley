import {
  conversationCacheSchema,
  type ConversationLevel,
  type ConversationMessage,
  type Debrief,
  type GoalStatus,
  type GoalProgress,
  type LanguageCode,
  type NpcEvaluation,
  type NpcGender,
  type ObjectiveAssessment,
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
  goalStatus?: GoalStatus;
  debrief?: Debrief;
  history: ConversationMessage[];
  replySuggestions: string[];
  evaluationHistory: NpcEvaluation[];
  objectiveHistory: ObjectiveAssessment[];
  scenarioKey?: string;
  languageCode?: LanguageCode;
}

export interface DebriefState {
  debrief: Debrief;
  sceneImageUrl: string;
  npcName: string;
  goalStatus: GoalStatus | "quit";
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
    goalStatus: "ongoing",
    history: [{
      role: "npc",
      text: cached.npcOpeningMessage,
      mood: cached.npcOpeningMood,
      npcFaceImageUrl: cached.npcFaceImageUrl,
    }],
    replySuggestions: cached.replySuggestions,
    evaluationHistory: [],
    objectiveHistory: [],
    scenarioKey: cached.scenarioKey,
    languageCode: cached.languageCode,
  };
}
