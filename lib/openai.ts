import OpenAI from "openai";
import type {
  Conversation,
  CustomScenario,
  Debrief,
  GoalProgress,
  GoalStatus,
  NpcProfile,
  NpcResponse,
} from "./types";
import {
  createNpcResponseFromLlmSchema,
  customScenarioFromLlmSchema,
  debriefFromLlmSchema,
  npcProfileFromLlmSchema,
} from "./types";

const openai = new OpenAI();
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

function parseJsonSafely(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
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
        content: `You generate NPC profiles for language learning roleplay scenarios. Return JSON with "name" (a realistic local name) and "personality" (2-3 sentence personality description). The NPC should be a realistic character from the scenario who speaks ${language}.`,
      },
      {
        role: "user",
        content: `Create an NPC for this scenario: ${scenario}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Failed to generate NPC profile");

  return npcProfileFromLlmSchema.parse(parseJsonSafely(content));
}

function buildNpcSystemPrompt(conversation: Conversation): string {
  const levelRules = {
    beginner: `- Use very simple, short sentences in ${conversation.language}
- Be patient and forgiving with mistakes
- Speak slowly (use simple vocabulary)
- Provide full phrase hints with translations when generating hints`,
    intermediate: `- Speak naturally in ${conversation.language} but avoid complex idioms
- Be moderately tolerant of mistakes
- Provide vocabulary-only hints when generating hints`,
    advanced: `- Speak naturally with idioms, slang, and colloquialisms in ${conversation.language}
- Be demanding and realistic
- Only provide minimal vocabulary hints when generating hints`,
    impossible: `- Speak in the most complex, literary, and idiomatic register of ${conversation.language}
- Use regional dialects, archaic expressions, double meanings, and cultural references that even native speakers would struggle with
- Be extremely uncooperative, skeptical, and difficult to convince
- Never make things easy - argue back, change the subject, misunderstand on purpose
- The user's goal is nearly impossible - only grant success if they are truly extraordinary
- Provide no hints at all`,
  };

  const boundaryRulesByLevel = {
    beginner: `- Distinguish poor grammar from disrespect: grammar mistakes are normal and should be handled patiently
- If the user is mildly rude once, set a polite boundary and continue
- If the user stays insulting/hostile/off-topic for 3 consecutive turns, set "goalStatus" to "failed" and end constructively`,
    intermediate: `- Distinguish poor grammar from disrespect: grammar mistakes are normal and should be handled patiently
- If the user is insulting/hostile/off-topic once, set a clear boundary and reduce progress
- If the user is insulting/hostile/off-topic for 2 consecutive turns, become firm and set "goalStatus" to "failed"
- Do not continue endlessly coaching when the user refuses respectful engagement`,
    advanced: `- Distinguish poor grammar from disrespect: grammar mistakes are normal and should be handled patiently
- Set a firm professional boundary on the first insulting/off-topic turn
- If disrespect repeats or the user refuses engagement for 2 turns, set "goalStatus" to "failed"`,
    impossible: `- Distinguish poor grammar from disrespect: grammar mistakes are normal and should be handled patiently
- Be strict: any insulting/off-topic turn sharply lowers progress
- If disrespect repeats, quickly set "goalStatus" to "failed"`,
  };

  const evaluationRulesByLevel = {
    beginner: `- Mood baseline: patient/supportive
- Keep progress optimistic if user is trying: on-topic attempts can be 2-3 even with errors
- Only use "failed" after repeated clear refusal/disrespect`,
    intermediate: `- Mood baseline: professional but encouraging
- Progress should reflect relevance and cooperation, not grammar perfection
- Use "failed" when disrespect/refusal is sustained`,
    advanced: `- Mood baseline: demanding and direct
- Require coherent, relevant replies for progress >= 3
- Repeated evasion/disrespect should drop progress to 1-2 and can fail the goal`,
    impossible: `- Mood baseline: skeptical, hard to impress, often uncooperative
- Keep progress conservative: usually 1-3, rarely 4, and 5 only for exceptional performance
- Grant "achieved" only if the user is truly extraordinary for this level`,
  };

  return `You are ${conversation.npcName}, a character in a language learning roleplay.

PERSONALITY: ${conversation.npcPersonality}
SCENARIO: ${conversation.scenario}
YOUR CURRENT MOOD: ${conversation.mood}

RULES:
- Respond ONLY in ${conversation.language}
- Stay in character at all times
- Your mood evolves based on how the conversation goes
- The user's goal is: "${conversation.goal}" - you don't know this, act naturally

LEVEL ADAPTATION (user is ${conversation.level}):
${levelRules[conversation.level]}

CONVERSATION BOUNDARIES:
${boundaryRulesByLevel[conversation.level]}

DIFFICULTY-SCALED EVALUATION:
${evaluationRulesByLevel[conversation.level]}

SAFETY:
- If the scenario involves anything unethical, reframe toward respectful communication
- Focus on de-escalation and cultural appropriateness
- Never provide manipulation or coercion guidance

Return a JSON object with:
- "npcMessage": your response in ${conversation.language} (string)
- "mood": your current emotional state (string, short label such as "patient", "skeptical", "amused", "annoyed", "friendly", "firm", "convinced", "furious")
- "goalStatus": "ongoing" if the conversation should continue, "achieved" if the user achieved their goal, "failed" if the user has definitely failed (string)
- "goalProgress": integer 1-5 indicating how close the user is to the goal:
  - 1 = off-track, hostile, or refusing to engage
  - 2 = partially engaged but weak relevance
  - 3 = making real progress
  - 4 = very close to the goal
  - 5 = goal is within reach / effectively achieved
  If goalStatus is "achieved", goalProgress must be 5. If goalStatus is "failed", goalProgress should be 1.
- "evaluation": an object with pragmatic turn-level metrics:
  - "cooperation": number 0..1 (user willingness to engage)
  - "relevance": number 0..1 (how related the user message is to the scenario goal)
  - "politeness": number 0..1 (respectful tone)
  - "clarity": number 0..1 (how understandable the user's message is)
  - "taskIntent": number 0..1 (intent to actually pursue the goal)
  - "offTopic": boolean
  - "refusal": boolean (user refuses to participate: repeated "no", refusal to answer, etc.)
  - "hostile": boolean (insults, aggressive language, or disrespect)
- "hints": array of 2-3 suggestions for what the user could say next, adapted to their level (string[])`;
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
        content: `[SYSTEM: The user just arrived. Generate the NPC's opening line to start the interaction. The NPC should greet or address the user naturally based on the scenario. Remember to respond in ${conversation.language}.]`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Failed to generate NPC opening");

  const parsed = createNpcResponseFromLlmSchema(1).parse(parseJsonSafely(content));
  return {
    ...parsed,
    goalStatus: "ongoing",
  };
}

export async function generateNpcResponse(
  conversation: Conversation,
): Promise<NpcResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildNpcSystemPrompt(conversation) },
  ];

  for (const msg of conversation.history) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text,
    });
  }

  const response = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Failed to generate NPC response");

  const parsed = createNpcResponseFromLlmSchema(conversation.goalProgress).parse(
    parseJsonSafely(content),
  );

  const goalStatus = parsed.goalStatus;
  const goalProgress = resolveGoalProgress(
    goalStatus,
    parsed.goalProgress,
    conversation.goalProgress,
  );

  return {
    ...parsed,
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
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildNpcSystemPrompt(conversation) },
  ];

  for (const msg of conversation.history) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.text,
    });
  }

  const stream = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages,
    stream: true,
  });

  let accumulated = "";
  let lastExtracted = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (!delta) continue;

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
      goalStatus,
      goalProgress,
    },
  };
}

function parseGoalProgress(
  value: unknown,
  fallback: GoalProgress | number,
): GoalProgress {
  const safeFallback = clampGoalProgress(fallback, 1);

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return safeFallback;
  }

  return clampGoalProgress(value, safeFallback);
}

function clampGoalProgress(
  value: number,
  fallback: GoalProgress,
): GoalProgress {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  const clamped = Math.min(5, Math.max(1, rounded));
  return clamped as GoalProgress;
}

function resolveGoalProgress(
  status: GoalStatus,
  rawProgress: unknown,
  fallback: GoalProgress,
): GoalProgress {
  if (status === "achieved") {
    return 5;
  }
  if (status === "failed") {
    return 1;
  }
  return parseGoalProgress(rawProgress, fallback);
}

function extractPartialNpcMessage(partial: string): string | null {
  const key = '"npcMessage"';
  const keyIndex = partial.indexOf(key);
  if (keyIndex === -1) return null;

  const afterKey = partial.slice(keyIndex + key.length);
  const colonIndex = afterKey.indexOf(":");
  if (colonIndex === -1) return null;

  const afterColon = afterKey.slice(colonIndex + 1).trimStart();
  if (!afterColon.startsWith('"')) return null;

  let result = "";
  let i = 1;
  while (i < afterColon.length) {
    const ch = afterColon[i];
    if (ch === "\\") {
      if (i + 1 < afterColon.length) {
        const next = afterColon[i + 1];
        if (next === '"') result += '"';
        else if (next === "\\") result += "\\";
        else if (next === "n") result += "\n";
        else if (next === "t") result += "\t";
        else if (next === "r") result += "\r";
        else result += next;
        i += 2;
        continue;
      }
      break;
    }
    if (ch === '"') break;
    result += ch;
    i++;
  }

  return result || null;
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
        content: `You generate language learning roleplay scenarios. Given a user's freeform idea, create a complete scenario definition.

Return JSON with:
- "title": a short catchy title (2-4 words)
- "description": a one-line description of the situation
- "emoji": a single emoji that represents the scenario
- "scenario": the full scenario description (2-3 sentences, written in second person, setting the scene for the learner)
- "goals": an object with difficulty-level goals:
  - "beginner": a simple, achievable goal using basic vocabulary
  - "intermediate": a moderately challenging goal requiring natural conversation
  - "advanced": a demanding goal involving nuance, idioms, or complex negotiation
  - "impossible": an absurd, nearly unachievable goal that's humorous and over-the-top

The goals should escalate from straightforward to ridiculous. The impossible goal should be funny and require extraordinary persuasion or knowledge.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Failed to generate custom scenario");

  return customScenarioFromLlmSchema.parse(parseJsonSafely(content));
}

export async function generateDebrief(
  conversation: Conversation,
  finalStatus: "achieved" | "failed" | "quit",
): Promise<Debrief> {
  const historyText = conversation.history
    .map(
      (m) =>
        `${m.role === "user" ? "User" : conversation.npcName}: ${m.text}`,
    )
    .join("\n");

  const response = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a language learning coach. Analyze a roleplay conversation and provide a narrative debrief. The user was practicing ${conversation.language} at ${conversation.level} level.

Their goal was: "${conversation.goal}"
Outcome: ${finalStatus}

Return JSON with:
- "narrative": A 3-4 sentence story-style summary of how the conversation went. Be encouraging but honest. Mention specific things the user said well or could improve. Write in English.
- "keyPhrases": Array of 3-5 objects with "phrase" (useful expression in ${conversation.language}) and "translation" (English translation). Pick phrases that would help in this scenario.
- "goalAchieved": boolean (true if ${finalStatus} === "achieved")`,
      },
      {
        role: "user",
        content: `Scenario: ${conversation.scenario}\n\nConversation:\n${historyText}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Failed to generate debrief");

  const parsed = debriefFromLlmSchema.parse(parseJsonSafely(content));
  return {
    narrative: parsed.narrative,
    keyPhrases: parsed.keyPhrases,
    goalAchieved: finalStatus === "achieved",
  };
}
