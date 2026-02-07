import type {
  Conversation,
  ConversationLevel,
  GoalProgress,
  GoalStatus,
  MoodState,
  NpcEvaluation,
  NpcResponse,
} from "./types";
import { normalizeToMoodState } from "./types";

interface PolicyProfile {
  failDisengagedStreak: number;
  failHostilityStreak: number;
  cautionDisengagedStreak: number;
  achievedScoreMin: number;
  basePenalty: number;
}

const POLICY_BY_LEVEL: Record<ConversationLevel, PolicyProfile> = {
  beginner: {
    failDisengagedStreak: 4,
    failHostilityStreak: 3,
    cautionDisengagedStreak: 3,
    achievedScoreMin: 0.85,
    basePenalty: 0.04,
  },
  intermediate: {
    failDisengagedStreak: 3,
    failHostilityStreak: 2,
    cautionDisengagedStreak: 2,
    achievedScoreMin: 0.88,
    basePenalty: 0.07,
  },
  advanced: {
    failDisengagedStreak: 2,
    failHostilityStreak: 2,
    cautionDisengagedStreak: 2,
    achievedScoreMin: 0.9,
    basePenalty: 0.1,
  },
  impossible: {
    failDisengagedStreak: 2,
    failHostilityStreak: 1,
    cautionDisengagedStreak: 1,
    achievedScoreMin: 0.95,
    basePenalty: 0.14,
  },
};

const WEIGHTS_BY_LEVEL: Record<
  ConversationLevel,
  Pick<NpcEvaluation, "cooperation" | "relevance" | "politeness" | "clarity" | "taskIntent">
> = {
  beginner: {
    cooperation: 0.25,
    relevance: 0.2,
    politeness: 0.2,
    clarity: 0.1,
    taskIntent: 0.25,
  },
  intermediate: {
    cooperation: 0.25,
    relevance: 0.25,
    politeness: 0.2,
    clarity: 0.1,
    taskIntent: 0.2,
  },
  advanced: {
    cooperation: 0.2,
    relevance: 0.3,
    politeness: 0.2,
    clarity: 0.15,
    taskIntent: 0.15,
  },
  impossible: {
    cooperation: 0.15,
    relevance: 0.35,
    politeness: 0.25,
    clarity: 0.1,
    taskIntent: 0.15,
  },
};

export function applyNpcPolicy(
  conversation: Conversation,
  llmResponse: NpcResponse,
): NpcResponse {
  const profile = POLICY_BY_LEVEL[conversation.level];
  const weights = WEIGHTS_BY_LEVEL[conversation.level];
  const evaluation = normalizeEvaluation(llmResponse.evaluation);

  const hostileTurn = evaluation.hostile || evaluation.politeness < 0.2;
  const disengagedTurn =
    evaluation.offTopic ||
    evaluation.refusal ||
    evaluation.cooperation < 0.35 ||
    evaluation.relevance < 0.35;

  const previousHostilityStreak = Number.isFinite(conversation.hostilityStreak)
    ? conversation.hostilityStreak
    : 0;
  const previousDisengagedStreak = Number.isFinite(conversation.disengagedStreak)
    ? conversation.disengagedStreak
    : 0;
  const previousConstructiveStreak = Number.isFinite(
    conversation.constructiveStreak,
  )
    ? conversation.constructiveStreak
    : 0;
  const previousGoalProgress = Number.isFinite(conversation.goalProgress)
    ? conversation.goalProgress
    : 1;

  conversation.hostilityStreak = hostileTurn ? previousHostilityStreak + 1 : 0;
  conversation.disengagedStreak = disengagedTurn ? previousDisengagedStreak + 1 : 0;

  const weightedScore = clampUnit(
    evaluation.cooperation * weights.cooperation +
      evaluation.relevance * weights.relevance +
      evaluation.politeness * weights.politeness +
      evaluation.clarity * weights.clarity +
      evaluation.taskIntent * weights.taskIntent,
  );

  const adjustedScore = clampUnit(
    weightedScore -
      profile.basePenalty -
      (evaluation.offTopic ? 0.15 : 0) -
      (evaluation.refusal ? 0.15 : 0) -
      (hostileTurn ? 0.25 : 0),
  );

  const constructiveTurn = adjustedScore >= 0.65 && !hostileTurn && !disengagedTurn;
  conversation.constructiveStreak = constructiveTurn
    ? previousConstructiveStreak + 1
    : 0;

  const hardFailure =
    conversation.hostilityStreak >= profile.failHostilityStreak ||
    conversation.disengagedStreak >= profile.failDisengagedStreak;

  let goalStatus: GoalStatus = "ongoing";
  const achievementSignal =
    llmResponse.goalStatus === "achieved" || llmResponse.goalProgress >= 4;
  if (hardFailure) {
    goalStatus = "failed";
  } else if (
    achievementSignal &&
    adjustedScore >= profile.achievedScoreMin &&
    conversation.constructiveStreak >= (conversation.level === "impossible" ? 2 : 1)
  ) {
    goalStatus = "achieved";
  }

  let goalProgress = scoreToProgress(adjustedScore);

  // Keep impossible mode conservative unless the user is clearly engaged.
  if (conversation.level === "impossible" && evaluation.taskIntent < 0.75) {
    goalProgress = Math.min(goalProgress, 3) as GoalProgress;
  }

  if (conversation.disengagedStreak >= profile.cautionDisengagedStreak) {
    goalProgress = Math.min(goalProgress, 2) as GoalProgress;
  }

  if (hostileTurn) {
    goalProgress = Math.min(goalProgress, previousGoalProgress, 2) as GoalProgress;
  } else {
    const maxStepUp = Math.min(5, previousGoalProgress + 1) as GoalProgress;
    goalProgress = Math.min(goalProgress, maxStepUp) as GoalProgress;
  }

  if (goalStatus === "achieved") {
    goalProgress = 5;
  } else if (goalStatus === "failed") {
    goalProgress = 1;
  }

  const mood = decideMood({
    level: conversation.level,
    goalStatus,
    adjustedScore,
    hostileTurn,
    disengagedStreak: conversation.disengagedStreak,
    llmMood: llmResponse.mood,
  });

  return {
    ...llmResponse,
    mood,
    goalStatus,
    goalProgress,
    evaluation,
  };
}

function decideMood(args: {
  level: ConversationLevel;
  goalStatus: GoalStatus;
  adjustedScore: number;
  hostileTurn: boolean;
  disengagedStreak: number;
  llmMood: string;
}): MoodState {
  if (args.goalStatus === "failed") {
    return args.level === "beginner" ? "annoyed" : "angry";
  }
  if (args.hostileTurn) {
    return args.level === "beginner" ? "annoyed" : "angry";
  }
  if (args.disengagedStreak >= 2) {
    return args.level === "impossible" ? "skeptical" : "annoyed";
  }
  if (args.adjustedScore >= 0.85) {
    return args.level === "impossible" ? "surprised" : "happy";
  }
  if (args.adjustedScore >= 0.65) {
    return "neutral";
  }
  if (args.adjustedScore <= 0.35) {
    return args.level === "beginner" ? "neutral" : "skeptical";
  }
  return normalizeMood(args.llmMood);
}

function scoreToProgress(score: number): GoalProgress {
  if (score < 0.2) return 1;
  if (score < 0.4) return 2;
  if (score < 0.65) return 3;
  if (score < 0.82) return 4;
  return 5;
}

function normalizeEvaluation(evaluation: NpcEvaluation): NpcEvaluation {
  return {
    cooperation: clampUnit(evaluation.cooperation),
    relevance: clampUnit(evaluation.relevance),
    politeness: clampUnit(evaluation.politeness),
    clarity: clampUnit(evaluation.clarity),
    taskIntent: clampUnit(evaluation.taskIntent),
    offTopic: Boolean(evaluation.offTopic),
    refusal: Boolean(evaluation.refusal),
    hostile: Boolean(evaluation.hostile),
  };
}

function normalizeMood(value: string): MoodState {
  const mood = value.trim();
  return mood.length > 0 ? normalizeToMoodState(mood) : "neutral";
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}
