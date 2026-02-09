import type { Conversation } from "@/core/types";

export function buildDebriefSystemPrompt(
  conversation: Conversation,
  finalStatus: "achieved" | "failed" | "quit",
): string {
  return `You are a language learning coach. Analyze a roleplay conversation and provide a narrative debrief. The user was practicing ${conversation.language} at ${conversation.level} level.

Their goal was: "${conversation.goal}"
Outcome: ${finalStatus}

Return JSON with:
- "narrative": A 3-4 sentence story-style summary of how the conversation went. Be encouraging but honest. Mention specific things the user said well or could improve. Write in English.
- "keyPhrases": Array of 3-5 objects with "phrase" (useful expression in ${conversation.language}) and "translation" (English translation). Pick phrases that would help in this scenario.
- "goalAchieved": boolean (true if ${finalStatus} === "achieved")`;
}

export function buildDebriefUserPrompt(
  scenario: string,
  historyText: string,
): string {
  return `Scenario: ${scenario}\n\nConversation:\n${historyText}`;
}
