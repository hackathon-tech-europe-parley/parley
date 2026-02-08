import OpenAI from "openai";
import {
  createNpcResponseFromLlmSchema,
  customScenarioFromLlmSchema,
  debriefFromLlmSchema,
  normalizeToMoodState,
  npcProfileFromLlmSchema,
  type Conversation,
  type CustomScenario,
  type Debrief,
  type NpcEvaluation,
  type NpcProfile,
  type NpcResponse,
} from "../types";
import {
  buildDebriefSystemPrompt,
  buildDebriefUserPrompt,
  buildNpcOpeningUserPrompt,
  buildNpcProfileSystemPrompt,
  buildNpcProfileUserPrompt,
  buildNpcSystemPrompt,
  buildSpecialPersonSystemPrompt,
  CUSTOM_SCENARIO_SYSTEM_PROMPT,
} from "./openai-prompts";
import {
  extractPartialNpcMessage,
  parseJsonSafely,
  resolveGoalProgress,
} from "./openai-parsing";
import { OPENAI_MODEL } from "../env";

const openai = new OpenAI();
const model = OPENAI_MODEL;

function toCompletionMessages(
  conversation: Conversation,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildNpcSystemPrompt(conversation) },
  ];

  for (const msg of conversation.history) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text,
    });
  }

  return messages;
}

function toSpecialPersonCompletionMessages(
  conversation: Conversation,
  specialPersonType: string,
  specialPersonName: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSpecialPersonSystemPrompt(conversation, specialPersonType, specialPersonName),
    },
  ];

  // Only include messages from when special person was called
  // For now, include all history but mark who is speaking
  for (const msg of conversation.history) {
    if (msg.role === "user") {
      messages.push({
        role: "user",
        content: msg.text,
      });
    } else {
      // NPC or special person message
      const speaker = msg.speakerName || conversation.npcName;
      messages.push({
        role: "assistant",
        content: `${speaker}: ${msg.text}`,
      });
    }
  }

  return messages;
}

export async function generateNpcProfile(
  scenario: string,
  language: string,
): Promise<NpcProfile> {
  const response = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildNpcProfileSystemPrompt(language),
      },
      {
        role: "user",
        content: buildNpcProfileUserPrompt(scenario),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate NPC profile");
  }

  return npcProfileFromLlmSchema.parse(parseJsonSafely(content));
}

export async function generateNpcOpening(
  conversation: Conversation,
): Promise<NpcResponse> {
  const response = await openai.chat.completions.create({
    model,
    temperature: 1.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildNpcSystemPrompt(conversation) },
      {
        role: "user",
        content: buildNpcOpeningUserPrompt(conversation),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate NPC opening");
  }

  const parsed = createNpcResponseFromLlmSchema(1).parse(parseJsonSafely(content));

  const openingMood = conversation.level === "impossible" ? "skeptical" :
    conversation.level === "beginner" ? "friendly" : "neutral";

  return {
    ...parsed,
    mood: openingMood,
    goalStatus: "ongoing",
    goalProgress: 1,
  };
}

export async function generateNpcResponse(
  conversation: Conversation,
): Promise<NpcResponse> {
  const response = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: toCompletionMessages(conversation),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate NPC response");
  }

  const parsed = createNpcResponseFromLlmSchema(conversation.goalProgress).parse(
    parseJsonSafely(content),
  );

  const normalizedMood = normalizeToMoodState(parsed.mood);

  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  return {
    ...parsed,
    mood: normalizedMood,
    goalStatus,
    goalProgress,
  };
}

export async function* generateNpcResponseStream(
  conversation: Conversation,
): AsyncGenerator<
  | { type: "token"; text: string }
  | { type: "complete"; data: NpcResponse }
> {
  const stream = await openai.chat.completions.create({
    model,
    temperature: 1.2,
    response_format: { type: "json_object" },
    messages: toCompletionMessages(conversation),
    stream: true,
  });

  let accumulated = "";
  let lastExtracted = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (!delta) {
      continue;
    }

    accumulated += delta;

    const extracted = extractPartialNpcMessage(accumulated);
    if (extracted && extracted !== lastExtracted) {
      const newText = extracted.slice(lastExtracted.length);
      if (newText) {
        yield { type: "token", text: newText };
      }
      lastExtracted = extracted;
    }
  }

  const parsed = createNpcResponseFromLlmSchema(conversation.goalProgress).parse(
    parseJsonSafely(accumulated),
  );

  const normalizedMood = normalizeToMoodState(parsed.mood);

  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  yield {
    type: "complete",
    data: {
      ...parsed,
      mood: normalizedMood,
      goalStatus,
      goalProgress,
    },
  };
}

export async function generateCustomScenario(
  prompt: string,
): Promise<CustomScenario> {
  const response = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: CUSTOM_SCENARIO_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate custom scenario");
  }

  return customScenarioFromLlmSchema.parse(parseJsonSafely(content));
}

export async function* generateSpecialPersonResponseStream(
  conversation: Conversation,
  specialPersonType: string,
  specialPersonName: string,
): AsyncGenerator<
  | { type: "token"; text: string }
  | { type: "complete"; data: NpcResponse }
> {
  const stream = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: toSpecialPersonCompletionMessages(conversation, specialPersonType, specialPersonName),
    stream: true,
  });

  let accumulated = "";
  let lastExtracted = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (!delta) {
      continue;
    }

    accumulated += delta;

    const extracted = extractPartialNpcMessage(accumulated);
    if (extracted && extracted !== lastExtracted) {
      const newText = extracted.slice(lastExtracted.length);
      if (newText) {
        yield { type: "token", text: newText };
      }
      lastExtracted = extracted;
    }
  }

  const parsed = createNpcResponseFromLlmSchema(conversation.goalProgress).parse(
    parseJsonSafely(accumulated),
  );

  const normalizedMood = normalizeToMoodState(parsed.mood);

  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  yield {
    type: "complete",
    data: {
      ...parsed,
      mood: normalizedMood,
      goalStatus,
      goalProgress,
    },
  };
}

export async function generateDebrief(
  conversation: Conversation,
  finalStatus: "achieved" | "failed" | "quit",
): Promise<Debrief> {
  const historyText = conversation.history
    .map((m) => `${m.role === "user" ? "User" : conversation.npcName}: ${m.text}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildDebriefSystemPrompt(conversation, finalStatus),
      },
      {
        role: "user",
        content: buildDebriefUserPrompt(conversation.scenario, historyText),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate debrief");
  }

  const parsed = debriefFromLlmSchema.parse(parseJsonSafely(content));
  const metrics = buildDebriefMetrics(conversation, finalStatus);

  return {
    narrative: parsed.narrative,
    keyPhrases: parsed.keyPhrases,
    goalAchieved: finalStatus === "achieved",
    metrics,
  };
}

function buildDebriefMetrics(
  conversation: Conversation,
  finalStatus: "achieved" | "failed" | "quit",
): NonNullable<Debrief["metrics"]> {
  const evaluationHistory = conversation.evaluationHistory ?? [];
  const objectiveHistory = conversation.objectiveHistory ?? [];
  const lastObjective = objectiveHistory[objectiveHistory.length - 1];

  return {
    turnsAnalyzed: Math.max(evaluationHistory.length, objectiveHistory.length),
    evaluationAverages: {
      cooperation: averageEvaluationMetric(evaluationHistory, "cooperation"),
      relevance: averageEvaluationMetric(evaluationHistory, "relevance"),
      politeness: averageEvaluationMetric(evaluationHistory, "politeness"),
      clarity: averageEvaluationMetric(evaluationHistory, "clarity"),
      taskIntent: averageEvaluationMetric(evaluationHistory, "taskIntent"),
    },
    objective: {
      score: clampUnit(
        lastObjective?.objectiveScore ?? progressToObjectiveScore(conversation.goalProgress),
      ),
      confidence: clampUnit(lastObjective?.confidence ?? 0.5),
      met: finalStatus === "achieved" || Boolean(lastObjective?.objectiveMet),
      checkpoints: lastObjective?.checkpoints ?? [],
      blockers: dedupeStrings([
        ...(lastObjective?.blockers ?? []),
        ...(finalStatus === "failed" ? ["conversation_failed"] : []),
        ...(finalStatus === "quit" ? ["user_quit"] : []),
      ]),
    },
  };
}

function averageEvaluationMetric(
  history: NpcEvaluation[],
  key: keyof Pick<
    NpcEvaluation,
    "cooperation" | "relevance" | "politeness" | "clarity" | "taskIntent"
  >,
): number {
  if (history.length === 0) {
    return 0;
  }
  const total = history.reduce((sum, item) => sum + clampUnit(item[key]), 0);
  return roundToHundredth(total / history.length);
}

function progressToObjectiveScore(progress: number): number {
  const normalized = Number.isFinite(progress) ? Math.round(progress) : 1;
  const clamped = Math.min(5, Math.max(1, normalized));
  return roundToHundredth((clamped - 1) / 4);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function roundToHundredth(value: number): number {
  return Math.round(clampUnit(value) * 100) / 100;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
