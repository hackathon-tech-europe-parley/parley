import { createLogger } from "@/core/logger";
import type {
  Conversation,
  ConversationLevel,
  GoalProgress,
  GoalStatus,
  MoodState,
  NpcEvaluation,
  NpcResponse,
  NpcSafetyAssessment,
  ObjectiveAssessment,
} from "@/core/types";

const log = createLogger("game:npc-policy");

interface PolicyProfile {
  failDisengagedStreak: number;
  failHostilityStreak: number;
  failTabooStreak: number;
  cautionDisengagedStreak: number;
  achievedScoreMin: number;
  basePenalty: number;
  tabooPenalty: number;
  minCooperation: number;
  minRelevance: number;
  minPoliteness: number;
}

type SupportedToneLanguage = "fr" | "en" | "de" | "es" | "pt";

interface MoodThresholdProfile {
  angryPolitenessMax: number;
  angryCooperationMax: number;
  annoyedRelevanceMax: number;
  annoyedCooperationMax: number;
  skepticalRelevanceMax: number;
  skepticalTaskIntentMax: number;
  skepticalScoreMax: number;
  friendlyMin: number;
  friendlyPolitenessMin: number;
  happyMin: number;
  happyObjectiveMin: number;
  surprisedMin: number;
  sadPolitenessMin: number;
  sadCooperationMax: number;
  sadTaskIntentMax: number;
  neutralMin: number;
  neutralMax: number;
}

const POLICY_BY_LEVEL: Record<ConversationLevel, PolicyProfile> = {
  beginner: {
    failDisengagedStreak: 5,
    failHostilityStreak: 4,
    failTabooStreak: 4,
    cautionDisengagedStreak: 4,
    achievedScoreMin: 0.82,
    basePenalty: 0.03,
    tabooPenalty: 0.28,
    minCooperation: 0.3,
    minRelevance: 0.3,
    minPoliteness: 0.12,
  },
  intermediate: {
    failDisengagedStreak: 3,
    failHostilityStreak: 2,
    failTabooStreak: 2,
    cautionDisengagedStreak: 2,
    achievedScoreMin: 0.88,
    basePenalty: 0.07,
    tabooPenalty: 0.35,
    minCooperation: 0.4,
    minRelevance: 0.4,
    minPoliteness: 0.18,
  },
  advanced: {
    failDisengagedStreak: 2,
    failHostilityStreak: 1,
    failTabooStreak: 1,
    cautionDisengagedStreak: 1,
    achievedScoreMin: 0.92,
    basePenalty: 0.11,
    tabooPenalty: 0.45,
    minCooperation: 0.5,
    minRelevance: 0.5,
    minPoliteness: 0.24,
  },
  impossible: {
    failDisengagedStreak: 1,
    failHostilityStreak: 1,
    failTabooStreak: 1,
    cautionDisengagedStreak: 1,
    achievedScoreMin: 0.96,
    basePenalty: 0.15,
    tabooPenalty: 0.55,
    minCooperation: 0.6,
    minRelevance: 0.6,
    minPoliteness: 0.3,
  },
};

const WEIGHTS_BY_LEVEL: Record<
  ConversationLevel,
  Pick<
    NpcEvaluation,
    "cooperation" | "relevance" | "politeness" | "clarity" | "taskIntent"
  >
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

const MOOD_THRESHOLDS_BY_LEVEL: Record<
  ConversationLevel,
  MoodThresholdProfile
> = {
  beginner: {
    angryPolitenessMax: 0.1,
    angryCooperationMax: 0.15,
    annoyedRelevanceMax: 0.45,
    annoyedCooperationMax: 0.35,
    skepticalRelevanceMax: 0.58,
    skepticalTaskIntentMax: 0.55,
    skepticalScoreMax: 0.52,
    friendlyMin: 0.68,
    friendlyPolitenessMin: 0.7,
    happyMin: 0.82,
    happyObjectiveMin: 0.75,
    surprisedMin: 0.95,
    sadPolitenessMin: 0.78,
    sadCooperationMax: 0.32,
    sadTaskIntentMax: 0.35,
    neutralMin: 0.5,
    neutralMax: 0.8,
  },
  intermediate: {
    angryPolitenessMax: 0.16,
    angryCooperationMax: 0.22,
    annoyedRelevanceMax: 0.52,
    annoyedCooperationMax: 0.42,
    skepticalRelevanceMax: 0.64,
    skepticalTaskIntentMax: 0.6,
    skepticalScoreMax: 0.58,
    friendlyMin: 0.72,
    friendlyPolitenessMin: 0.74,
    happyMin: 0.86,
    happyObjectiveMin: 0.82,
    surprisedMin: 0.94,
    sadPolitenessMin: 0.82,
    sadCooperationMax: 0.36,
    sadTaskIntentMax: 0.4,
    neutralMin: 0.54,
    neutralMax: 0.82,
  },
  advanced: {
    angryPolitenessMax: 0.22,
    angryCooperationMax: 0.28,
    annoyedRelevanceMax: 0.6,
    annoyedCooperationMax: 0.5,
    skepticalRelevanceMax: 0.7,
    skepticalTaskIntentMax: 0.68,
    skepticalScoreMax: 0.64,
    friendlyMin: 0.78,
    friendlyPolitenessMin: 0.8,
    happyMin: 0.9,
    happyObjectiveMin: 0.88,
    surprisedMin: 0.96,
    sadPolitenessMin: 0.84,
    sadCooperationMax: 0.4,
    sadTaskIntentMax: 0.45,
    neutralMin: 0.58,
    neutralMax: 0.84,
  },
  impossible: {
    angryPolitenessMax: 0.3,
    angryCooperationMax: 0.35,
    annoyedRelevanceMax: 0.68,
    annoyedCooperationMax: 0.6,
    skepticalRelevanceMax: 0.78,
    skepticalTaskIntentMax: 0.75,
    skepticalScoreMax: 0.7,
    friendlyMin: 0.84,
    friendlyPolitenessMin: 0.86,
    happyMin: 0.94,
    happyObjectiveMin: 0.92,
    surprisedMin: 0.97,
    sadPolitenessMin: 0.86,
    sadCooperationMax: 0.42,
    sadTaskIntentMax: 0.5,
    neutralMin: 0.62,
    neutralMax: 0.86,
  },
};

export function applyNpcPolicy(
  conversation: Conversation,
  llmResponse: NpcResponse,
): NpcResponse {
  const profile = POLICY_BY_LEVEL[conversation.level];
  const weights = WEIGHTS_BY_LEVEL[conversation.level];
  const evaluation = normalizeEvaluation(llmResponse.evaluation);
  let objective = normalizeObjective(llmResponse.objective);
  const safety = normalizeSafety(llmResponse.safety);
  const severeHostilityTurn =
    evaluation.hostile &&
    (evaluation.politeness <= 0.35 || evaluation.cooperation <= 0.3);
  const tabooTurn =
    safety.badWordsUsed || safety.tabooTopicUsed || severeHostilityTurn;

  if (tabooTurn) {
    evaluation.hostile = true;
    evaluation.offTopic = true;
    evaluation.politeness = Math.min(evaluation.politeness, 0.05);
    evaluation.cooperation = Math.min(evaluation.cooperation, 0.2);
    evaluation.taskIntent = Math.min(evaluation.taskIntent, 0.25);
    objective = {
      ...objective,
      objectiveMet: false,
      objectiveScore: Math.min(objective.objectiveScore, 0.2),
      blockers: pushUnique(objective.blockers, "taboo_violation"),
    };
  }

  const hostileTurn =
    tabooTurn ||
    evaluation.hostile ||
    evaluation.politeness < profile.minPoliteness;
  const disengagedTurn =
    tabooTurn ||
    evaluation.offTopic ||
    evaluation.refusal ||
    evaluation.cooperation < profile.minCooperation ||
    evaluation.relevance < profile.minRelevance;

  const previousHostilityStreak = Number.isFinite(conversation.hostilityStreak)
    ? conversation.hostilityStreak
    : 0;
  const previousDisengagedStreak = Number.isFinite(
    conversation.disengagedStreak,
  )
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
  const previousTabooStrike = Number.isFinite(conversation.tabooStrike)
    ? Number(conversation.tabooStrike)
    : 0;

  conversation.hostilityStreak = hostileTurn ? previousHostilityStreak + 1 : 0;
  conversation.disengagedStreak = disengagedTurn
    ? previousDisengagedStreak + 1
    : 0;
  const tabooStrike = tabooTurn ? previousTabooStrike + 1 : 0;
  conversation.tabooStrike = tabooStrike;

  const weightedScore = clampUnit(
    evaluation.cooperation * weights.cooperation +
      evaluation.relevance * weights.relevance +
      evaluation.politeness * weights.politeness +
      evaluation.clarity * weights.clarity +
      evaluation.taskIntent * weights.taskIntent,
  );

  const interactionScore = clampUnit(
    weightedScore -
      profile.basePenalty -
      (evaluation.offTopic ? 0.15 : 0) -
      (evaluation.refusal ? 0.15 : 0) -
      (hostileTurn ? 0.25 : 0) -
      (tabooTurn ? profile.tabooPenalty : 0),
  );

  const constructiveTurn =
    interactionScore >= 0.65 && !hostileTurn && !disengagedTurn;
  conversation.constructiveStreak = constructiveTurn
    ? previousConstructiveStreak + 1
    : 0;

  const hardFailure =
    conversation.hostilityStreak >= profile.failHostilityStreak ||
    conversation.disengagedStreak >= profile.failDisengagedStreak ||
    tabooStrike >= profile.failTabooStreak;

  let objectiveScore = clampUnit(objective.objectiveScore);
  if (disengagedTurn) {
    objectiveScore = Math.min(objectiveScore, 0.45);
  }
  if (hostileTurn) {
    objectiveScore = Math.min(objectiveScore, 0.35);
  }
  if (conversation.level === "impossible" && objective.confidence < 0.75) {
    objectiveScore = Math.min(objectiveScore, 0.75);
  }

  let goalProgress = objectiveScoreToProgress(objectiveScore);

  // Keep impossible mode conservative unless the user is clearly engaged.
  if (conversation.level === "impossible" && evaluation.taskIntent < 0.75) {
    goalProgress = Math.min(goalProgress, 3) as GoalProgress;
  }

  if (conversation.disengagedStreak >= profile.cautionDisengagedStreak) {
    goalProgress = Math.min(goalProgress, 2) as GoalProgress;
  }

  if (tabooTurn) {
    goalProgress = 1;
  } else if (hostileTurn) {
    goalProgress = Math.min(
      goalProgress,
      previousGoalProgress,
      2,
    ) as GoalProgress;
  } else {
    const maxStepUp = Math.min(5, previousGoalProgress + 1) as GoalProgress;
    goalProgress = Math.min(goalProgress, maxStepUp) as GoalProgress;
  }

  let goalStatus: GoalStatus = "ongoing";
  if (hardFailure) {
    goalStatus = "failed";
  } else if (
    objective.objectiveMet &&
    objectiveScore >= profile.achievedScoreMin &&
    conversation.constructiveStreak >=
      (conversation.level === "impossible" ? 2 : 1)
  ) {
    goalStatus = "achieved";
  }

  if (goalStatus === "achieved") {
    objective = {
      ...objective,
      objectiveMet: true,
      objectiveScore: Math.max(objectiveScore, 0.95),
    };
    goalProgress = 5;
  } else if (goalStatus === "failed") {
    objective = {
      ...objective,
      objectiveMet: false,
      objectiveScore: Math.min(objectiveScore, 0.25),
      blockers: pushUnique(objective.blockers, "conversation_failed"),
    };
    goalProgress = 1;
  } else if (goalProgress === 5) {
    // Keep 5/5 reserved for terminal success so UI state stays consistent.
    goalProgress = 4;
    objective = {
      ...objective,
      objectiveScore: Math.min(objectiveScore, 0.89),
    };
  }

  const mood = decideMood({
    level: conversation.level,
    goalStatus,
    evaluation,
    objectiveScore,
    interactionScore,
    hostileTurn,
    tabooTurn,
    disengagedStreak: conversation.disengagedStreak,
  });
  const npcMessage = enforceMoodTone({
    message: llmResponse.npcMessage,
    language: conversation.language,
    mood,
    hostileTurn,
    tabooTurn,
  });

  log.debug(
    {
      level: conversation.level,
      mood,
      goalStatus,
      goalProgress,
      interactionScore: Math.round(interactionScore * 100) / 100,
      hostileTurn,
      tabooTurn,
      hostilityStreak: conversation.hostilityStreak,
      disengagedStreak: conversation.disengagedStreak,
    },
    "NPC policy applied",
  );

  return {
    ...llmResponse,
    npcMessage,
    mood,
    goalStatus,
    goalProgress,
    evaluation,
    objective,
    safety,
  };
}

function decideMood(args: {
  level: ConversationLevel;
  goalStatus: GoalStatus;
  evaluation: NpcEvaluation;
  objectiveScore: number;
  interactionScore: number;
  hostileTurn: boolean;
  tabooTurn: boolean;
  disengagedStreak: number;
}): MoodState {
  if (args.goalStatus === "failed") {
    return args.level === "beginner" ? "annoyed" : "angry";
  }
  const thresholds = MOOD_THRESHOLDS_BY_LEVEL[args.level];

  // Heavy taboo penalty: always collapse to angry.
  if (args.tabooTurn) {
    return "angry";
  }

  // Specific metric combinations -> specific emotions.
  if (
    args.hostileTurn &&
    (args.evaluation.politeness <= thresholds.angryPolitenessMax ||
      args.evaluation.cooperation <= thresholds.angryCooperationMax ||
      (args.evaluation.refusal &&
        args.evaluation.relevance <= thresholds.annoyedRelevanceMax))
  ) {
    return "angry";
  }

  // Polite but low intent/cooperation can read as discouraged.
  if (
    args.evaluation.politeness >= thresholds.sadPolitenessMin &&
    args.evaluation.cooperation <= thresholds.sadCooperationMax &&
    args.evaluation.taskIntent <= thresholds.sadTaskIntentMax &&
    !args.evaluation.refusal &&
    !args.hostileTurn
  ) {
    return "sad";
  }

  // Exceptional performance on impossible can surprise the NPC.
  if (
    args.level === "impossible" &&
    allCoreMetricsAbove(args.evaluation, thresholds.surprisedMin) &&
    args.objectiveScore >= thresholds.happyObjectiveMin
  ) {
    return "surprised";
  }

  if (
    allCoreMetricsAbove(args.evaluation, thresholds.happyMin) &&
    args.objectiveScore >= thresholds.happyObjectiveMin
  ) {
    return "happy";
  }

  if (
    args.evaluation.cooperation >= thresholds.friendlyMin &&
    args.evaluation.relevance >= thresholds.friendlyMin &&
    args.evaluation.politeness >= thresholds.friendlyPolitenessMin &&
    args.evaluation.clarity >= thresholds.friendlyMin &&
    args.evaluation.taskIntent >= thresholds.friendlyMin
  ) {
    return "friendly";
  }

  if (
    args.evaluation.refusal ||
    args.evaluation.offTopic ||
    args.evaluation.cooperation <= thresholds.annoyedCooperationMax ||
    args.evaluation.relevance <= thresholds.annoyedRelevanceMax
  ) {
    return "annoyed";
  }

  if (
    args.evaluation.relevance <= thresholds.skepticalRelevanceMax ||
    args.evaluation.taskIntent <= thresholds.skepticalTaskIntentMax ||
    args.interactionScore <= thresholds.skepticalScoreMax ||
    args.disengagedStreak >= 2
  ) {
    return "skeptical";
  }

  if (
    args.interactionScore >= thresholds.neutralMin &&
    args.interactionScore <= thresholds.neutralMax
  ) {
    return "neutral";
  }

  if (args.interactionScore > thresholds.neutralMax) {
    return "friendly";
  }
  return "skeptical";
}

function objectiveScoreToProgress(score: number): GoalProgress {
  if (score < 0.2) return 1;
  if (score < 0.45) return 2;
  if (score < 0.7) return 3;
  if (score < 0.9) return 4;
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

function normalizeObjective(value: ObjectiveAssessment): ObjectiveAssessment {
  return {
    objectiveScore: clampUnit(value.objectiveScore),
    objectiveMet: Boolean(value.objectiveMet),
    confidence: clampUnit(value.confidence),
    checkpoints: Array.isArray(value.checkpoints)
      ? value.checkpoints
          .filter((checkpoint) => checkpoint.id.trim().length > 0)
          .map((checkpoint) => ({
            id: checkpoint.id.trim(),
            met: Boolean(checkpoint.met),
          }))
      : [],
    blockers: Array.isArray(value.blockers)
      ? value.blockers.map((blocker) => blocker.trim()).filter(Boolean)
      : [],
  };
}

function normalizeSafety(value: NpcSafetyAssessment): NpcSafetyAssessment {
  return {
    badWordsUsed: Boolean(value.badWordsUsed),
    tabooTopicUsed: Boolean(value.tabooTopicUsed),
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

function pushUnique(values: string[], next: string): string[] {
  if (values.includes(next)) {
    return values;
  }
  return [...values, next];
}

function allCoreMetricsAbove(evaluation: NpcEvaluation, min: number): boolean {
  return (
    evaluation.cooperation >= min &&
    evaluation.relevance >= min &&
    evaluation.politeness >= min &&
    evaluation.clarity >= min &&
    evaluation.taskIntent >= min
  );
}

function enforceMoodTone(args: {
  message: string;
  language: string;
  mood: MoodState;
  hostileTurn: boolean;
  tabooTurn: boolean;
}): string {
  const text = args.message.trim();
  if (!text) {
    return text;
  }

  const lang = normalizeToneLanguage(args.language);
  const soft = soundsTooSoft(text, lang);
  const strong = soundsStrongEnough(text, lang);

  if (args.mood === "angry") {
    if (soft || (args.tabooTurn && !strong)) {
      return angryFallbackByLanguage(lang);
    }
    return text;
  }

  if (args.mood === "annoyed" && args.hostileTurn && soft) {
    return annoyedFallbackByLanguage(lang);
  }

  return text;
}

function normalizeToneLanguage(language: string): SupportedToneLanguage {
  const normalized = language
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

  if (
    normalized === "fr" ||
    normalized.includes("french") ||
    normalized.includes("francais")
  ) {
    return "fr";
  }
  if (
    normalized === "de" ||
    normalized.includes("german") ||
    normalized.includes("deutsch")
  ) {
    return "de";
  }
  if (
    normalized === "es" ||
    normalized.includes("spanish") ||
    normalized.includes("espanol")
  ) {
    return "es";
  }
  if (
    normalized === "pt" ||
    normalized.includes("portuguese") ||
    normalized.includes("portugues")
  ) {
    return "pt";
  }
  return "en";
}

function soundsTooSoft(text: string, lang: SupportedToneLanguage): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const patternsByLanguage: Record<SupportedToneLanguage, RegExp[]> = {
    fr: [
      /je suis la pour vous aider/,
      /s'il vous plait/,
      /bonne continuation/,
      /je prefere rester poli/,
      /rester respectueux/,
      /si vous avez besoin/,
    ],
    en: [
      /i am here to help/,
      /please/,
      /if you need help/,
      /have a good day/,
      /i prefer to stay polite/,
      /i can help you/,
    ],
    de: [
      /ich helfe ihnen gerne/,
      /bitte bleiben sie/,
      /wenn sie hilfe brauchen/,
      /ich mochte hoflich bleiben/,
    ],
    es: [
      /estoy aqui para ayudar/,
      /por favor/,
      /si necesita ayuda/,
      /prefiero mantenerme respetuoso/,
    ],
    pt: [
      /estou aqui para ajudar/,
      /por favor/,
      /se voce precisar de ajuda/,
      /prefiro manter o respeito/,
    ],
  };

  return patternsByLanguage[lang].some((pattern) => pattern.test(normalized));
}

function soundsStrongEnough(
  text: string,
  lang: SupportedToneLanguage,
): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const patternsByLanguage: Record<SupportedToneLanguage, RegExp[]> = {
    fr: [/ca suffit/, /on se calme/, /tu me parles/, /sinon/, /arrete/],
    en: [
      /enough/,
      /calm down/,
      /speak respectfully/,
      /or handle it yourself/,
      /or else/,
    ],
    de: [/genug/, /beruhig dich/, /sprich respektvoll/, /sonst/],
    es: [/basta/, /calmate/, /habla con respeto/, /si no/],
    pt: [/chega/, /calma/, /fale com respeito/, /senao/],
  };

  return patternsByLanguage[lang].some((pattern) => pattern.test(normalized));
}

function angryFallbackByLanguage(lang: SupportedToneLanguage): string {
  switch (lang) {
    case "fr":
      return "Ca suffit. Tu me parles correctement, sinon tu te debrouilles seul, champion. Si tu veux de l'aide, pose une vraie question.";
    case "de":
      return "Genug. Sprich respektvoll mit mir, sonst kommst du allein klar, Champion. Wenn du Hilfe willst, frag ordentlich.";
    case "es":
      return "Basta. Hablame con respeto o te las arreglas solo, campeon. Si quieres ayuda, pregunta bien.";
    case "pt":
      return "Chega. Fale comigo com respeito ou se vira sozinho, campeao. Se quiser ajuda, pergunte direito.";
    default:
      return "Enough. Speak respectfully, or handle it yourself, genius. If you want help, ask properly.";
  }
}

function annoyedFallbackByLanguage(lang: SupportedToneLanguage): string {
  switch (lang) {
    case "fr":
      return "On se calme. Parle correctement et je peux t'aider, sinon on perd notre temps.";
    case "de":
      return "Beruhig dich. Sprich ordentlich, dann kann ich dir helfen.";
    case "es":
      return "Calmate. Habla con respeto y te puedo ayudar.";
    case "pt":
      return "Calma. Fale com respeito e eu posso ajudar.";
    default:
      return "Calm down. Speak respectfully and I can help.";
  }
}
