import { createLogger } from "@/core/logger";
import {
  type Conversation,
  createNpcResponseFromLlmSchema,
  type NpcProfile,
  type NpcResponse,
  normalizeToMoodState,
  npcProfileFromLlmSchema,
} from "@/core/types";
import {
  npcProfileApiSchema,
  npcResponseApiSchema,
} from "@/core/types/llm-api";
import { generateStructured, streamStructured } from "@/infra/llm";
import {
  toCompletionMessages,
  toSpecialPersonCompletionMessages,
} from "./messages";
import { resolveGoalProgress } from "./parsing";
import {
  buildNpcOpeningUserPrompt,
  buildNpcProfileSystemPrompt,
  buildNpcProfileUserPrompt,
  buildNpcSystemPrompt,
} from "./prompts";

const log = createLogger("ai:npc");

export async function generateNpcProfile(
  scenario: string,
  language: string,
): Promise<NpcProfile> {
  log.info({ language }, "generating NPC profile");
  const start = Date.now();

  const { object } = await generateStructured(npcProfileApiSchema, {
    messages: [
      { role: "system", content: buildNpcProfileSystemPrompt(language) },
      { role: "user", content: buildNpcProfileUserPrompt(scenario) },
    ],
  });

  const profile = npcProfileFromLlmSchema.parse(object);
  log.info(
    {
      durationMs: Date.now() - start,
      name: profile.name,
      gender: profile.gender,
    },
    "NPC profile generated",
  );
  return profile;
}

export async function generateNpcOpening(
  conversation: Conversation,
): Promise<NpcResponse> {
  log.info({ level: conversation.level }, "generating NPC opening");
  const start = Date.now();

  const { object } = await generateStructured(npcResponseApiSchema, {
    temperature: 1.2,
    messages: [
      { role: "system", content: buildNpcSystemPrompt(conversation) },
      { role: "user", content: buildNpcOpeningUserPrompt(conversation) },
    ],
  });

  const parsed = createNpcResponseFromLlmSchema(1).parse(object);

  const openingMood =
    conversation.level === "impossible"
      ? "skeptical"
      : conversation.level === "beginner"
        ? "friendly"
        : "neutral";

  log.info(
    { durationMs: Date.now() - start, mood: openingMood },
    "NPC opening generated",
  );
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
  log.info({ turn: conversation.turnCount }, "generating NPC response");
  const start = Date.now();

  const { object } = await generateStructured(npcResponseApiSchema, {
    messages: toCompletionMessages(conversation),
  });

  const parsed = createNpcResponseFromLlmSchema(
    conversation.goalProgress,
  ).parse(object);

  const normalizedMood = normalizeToMoodState(parsed.mood);
  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  log.info(
    {
      durationMs: Date.now() - start,
      mood: normalizedMood,
      goalStatus,
      goalProgress,
    },
    "NPC response generated",
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
  { type: "token"; text: string } | { type: "complete"; data: NpcResponse }
> {
  log.info({ turn: conversation.turnCount }, "streaming NPC response");
  const start = Date.now();

  const { partialObjectStream, object: objectPromise } = streamStructured(
    npcResponseApiSchema,
    {
      temperature: 1.2,
      messages: toCompletionMessages(conversation),
    },
  );

  let lastMessage = "";

  for await (const partial of partialObjectStream) {
    const current = partial.npcMessage ?? "";
    if (current.length > lastMessage.length) {
      const newText = current.slice(lastMessage.length);
      yield { type: "token", text: newText };
      lastMessage = current;
    }
  }

  const finalObject = await objectPromise;
  const parsed = createNpcResponseFromLlmSchema(
    conversation.goalProgress,
  ).parse(finalObject);

  const normalizedMood = normalizeToMoodState(parsed.mood);
  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  log.info(
    {
      durationMs: Date.now() - start,
      mood: normalizedMood,
      goalStatus,
      goalProgress,
    },
    "NPC response stream complete",
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

export async function* generateSpecialPersonResponseStream(
  conversation: Conversation,
  specialPersonType: string,
  specialPersonName: string,
): AsyncGenerator<
  { type: "token"; text: string } | { type: "complete"; data: NpcResponse }
> {
  log.info(
    { specialPersonType, specialPersonName },
    "streaming special person response",
  );
  const start = Date.now();

  const { partialObjectStream, object: objectPromise } = streamStructured(
    npcResponseApiSchema,
    {
      messages: toSpecialPersonCompletionMessages(
        conversation,
        specialPersonType,
        specialPersonName,
      ),
    },
  );

  let lastMessage = "";

  for await (const partial of partialObjectStream) {
    const current = partial.npcMessage ?? "";
    if (current.length > lastMessage.length) {
      const newText = current.slice(lastMessage.length);
      yield { type: "token", text: newText };
      lastMessage = current;
    }
  }

  const finalObject = await objectPromise;
  const parsed = createNpcResponseFromLlmSchema(
    conversation.goalProgress,
  ).parse(finalObject);

  const normalizedMood = normalizeToMoodState(parsed.mood);
  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  log.info(
    { durationMs: Date.now() - start, mood: normalizedMood, goalStatus },
    "special person response stream complete",
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
