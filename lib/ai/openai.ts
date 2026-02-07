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
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildNpcSystemPrompt(conversation) },
      {
        role: "user",
        content: buildNpcOpeningUserPrompt(conversation.language),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Failed to generate NPC opening");
  }

  const parsed = createNpcResponseFromLlmSchema(1).parse(parseJsonSafely(content));

  const normalizedMood = normalizeToMoodState(parsed.mood);

  return {
    ...parsed,
    mood: normalizedMood,
    goalStatus: "ongoing",
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
  return {
    narrative: parsed.narrative,
    keyPhrases: parsed.keyPhrases,
    goalAchieved: finalStatus === "achieved",
  };
}
