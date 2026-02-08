import type {
  ConversationLevel,
  ConversationRole,
  GoalProgress,
  GoalStatus,
  LanguageCode,
  NpcGender,
} from "./constants";

export interface ConversationMessage {
  role: ConversationRole;
  text: string;
  mood?: string;
  npcFaceImageUrl?: string;
}

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
  goalStatus?: GoalStatus;
  debrief?: Debrief;
  turnCount?: number;
  tabooStrike?: number;
  evaluationHistory?: NpcEvaluation[];
  objectiveHistory?: ObjectiveAssessment[];
  scenarioKey?: string;
  languageCode?: LanguageCode;
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

export interface ObjectiveCheckpoint {
  id: string;
  met: boolean;
}

export interface ObjectiveAssessment {
  objectiveScore: number;
  objectiveMet: boolean;
  confidence: number;
  checkpoints: ObjectiveCheckpoint[];
  blockers: string[];
}

export interface NpcSafetyAssessment {
  badWordsUsed: boolean;
  tabooTopicUsed: boolean;
}

export interface NpcResponse {
  npcMessage: string;
  mood: string;
  goalStatus: GoalStatus;
  goalProgress: GoalProgress;
  evaluation: NpcEvaluation;
  objective: ObjectiveAssessment;
  safety: NpcSafetyAssessment;
  hints: string[];
  replySuggestions: string[];
}

export interface NpcProfile {
  name: string;
  personality: string;
  gender: NpcGender;
}

export interface Debrief {
  narrative: string;
  keyPhrases: Array<{ phrase: string; translation: string }>;
  goalAchieved: boolean;
  metrics?: {
    turnsAnalyzed: number;
    evaluationAverages: {
      cooperation: number;
      relevance: number;
      politeness: number;
      clarity: number;
      taskIntent: number;
    };
    objective: {
      score: number;
      confidence: number;
      met: boolean;
      checkpoints: ObjectiveCheckpoint[];
      blockers: string[];
    };
  };
}

export interface ConversationSnapshot {
  conversationId: string;
  scenario: string;
  language: string;
  level: ConversationLevel;
  goal: string;
  npcName: string;
  mood: string;
  goalProgress: GoalProgress;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  npcGender: NpcGender;
  goalStatus?: GoalStatus;
  debrief?: Debrief;
  history: ConversationMessage[];
  hints: string[];
  replySuggestions: string[];
  evaluationHistory?: NpcEvaluation[];
  objectiveHistory?: ObjectiveAssessment[];
  scenarioKey?: string;
  languageCode?: LanguageCode;
}

export interface CustomScenario {
  title: string;
  description: string;
  emoji: string;
  scenario: string;
  goals: {
    beginner: string;
    intermediate: string;
    advanced: string;
    impossible: string;
  };
}

export interface CreateConversationResponse {
  conversationId: string;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  npcName: string;
  npcGender: NpcGender;
  npcOpeningMessage: string;
  npcOpeningMood: string;
  npcOpeningGoalProgress: GoalProgress;
  hints: string[];
  replySuggestions: string[];
  scenario: string;
  goal: string;
  language: string;
  level: ConversationLevel;
}

export interface QuitConversationResponse {
  debrief: Debrief;
  sceneImageUrl: string;
  npcName: string;
  goalStatus: "quit";
  conversationHistory: ConversationMessage[];
}

export interface MessageStreamCompletePayload {
  npcMessage: string;
  mood: string;
  goalStatus: GoalStatus;
  goalProgress: GoalProgress;
  evaluation: NpcEvaluation;
  objective: ObjectiveAssessment;
  hints: string[];
  replySuggestions: string[];
  sceneImageUrl: string;
  npcFaceImageUrl?: string;
  debrief?: Debrief;
}
