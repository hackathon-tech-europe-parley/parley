export const CONVERSATION_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "impossible",
] as const;

export const GOAL_STATUSES = ["ongoing", "achieved", "failed"] as const;

export const GOAL_PROGRESS_VALUES = [1, 2, 3, 4, 5] as const;

export const CONVERSATION_ROLES = ["user", "npc"] as const;

export const LANGUAGE_CODES = ["en", "fr", "de", "es", "pt"] as const;

export const NPC_GENDERS = ["masculine", "feminine"] as const;

export type ConversationLevel = (typeof CONVERSATION_LEVELS)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type GoalProgress = (typeof GOAL_PROGRESS_VALUES)[number];
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];
export type LanguageCode = (typeof LANGUAGE_CODES)[number];
export type NpcGender = (typeof NPC_GENDERS)[number];
