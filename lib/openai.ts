import OpenAI from "openai";
import type { Conversation, NpcResponse, NpcProfile, Debrief } from "./types";

const openai = new OpenAI();
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
  return JSON.parse(content) as NpcProfile;
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

SAFETY:
- If the scenario involves anything unethical, reframe toward respectful communication
- Focus on de-escalation and cultural appropriateness
- Never provide manipulation or coercion guidance

Return a JSON object with:
- "npcMessage": your response in ${conversation.language} (string)
- "mood": your current emotional state (string, e.g. "skeptical", "amused", "annoyed", "friendly", "convinced", "furious")
- "goalStatus": "ongoing" if the conversation should continue, "achieved" if the user achieved their goal, "failed" if the user has definitely failed (string)
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

  const parsed = JSON.parse(content);
  return {
    npcMessage: parsed.npcMessage || "...",
    mood: parsed.mood || "neutral",
    goalStatus: "ongoing",
    hints: parsed.hints || [],
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

  const parsed = JSON.parse(content);
  return {
    npcMessage: parsed.npcMessage || "...",
    mood: parsed.mood || "neutral",
    goalStatus: parsed.goalStatus || "ongoing",
    hints: parsed.hints || [],
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

    // Try to extract partial npcMessage from the accumulating JSON
    const extracted = extractPartialNpcMessage(accumulated);
    if (extracted && extracted !== lastExtracted) {
      const newText = extracted.slice(lastExtracted.length);
      if (newText) {
        yield { type: "token", text: newText };
      }
      lastExtracted = extracted;
    }
  }

  // Parse the final complete JSON
  const parsed = JSON.parse(accumulated);
  const data: NpcResponse = {
    npcMessage: parsed.npcMessage || "...",
    mood: parsed.mood || "neutral",
    goalStatus: parsed.goalStatus || "ongoing",
    hints: parsed.hints || [],
  };

  yield { type: "complete", data };
}

function extractPartialNpcMessage(partial: string): string | null {
  // Look for "npcMessage": " or "npcMessage":" and extract the value so far
  const key = '"npcMessage"';
  const keyIndex = partial.indexOf(key);
  if (keyIndex === -1) return null;

  // Find the opening quote of the value
  const afterKey = partial.slice(keyIndex + key.length);
  const colonIndex = afterKey.indexOf(":");
  if (colonIndex === -1) return null;

  const afterColon = afterKey.slice(colonIndex + 1).trimStart();
  if (!afterColon.startsWith('"')) return null;

  // Extract string value, handling escape sequences
  let result = "";
  let i = 1; // skip opening quote
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
    if (ch === '"') break; // closing quote
    result += ch;
    i++;
  }

  return result || null;
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

  const parsed = JSON.parse(content);
  return {
    narrative: parsed.narrative || "The conversation has ended.",
    keyPhrases: parsed.keyPhrases || [],
    goalAchieved: finalStatus === "achieved",
  };
}
