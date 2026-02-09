import type { ModelMessage } from "ai";
import type { Conversation } from "@/core/types";
import {
  buildNpcSystemPrompt,
  buildSpecialPersonSystemPrompt,
} from "./prompts";

export function toCompletionMessages(
  conversation: Conversation,
): ModelMessage[] {
  const messages: ModelMessage[] = [
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

export function toSpecialPersonCompletionMessages(
  conversation: Conversation,
  specialPersonType: string,
  specialPersonName: string,
): ModelMessage[] {
  const messages: ModelMessage[] = [
    {
      role: "system",
      content: buildSpecialPersonSystemPrompt(
        conversation,
        specialPersonType,
        specialPersonName,
      ),
    },
  ];

  for (const msg of conversation.history) {
    if (msg.role === "user") {
      messages.push({ role: "user", content: msg.text });
    } else {
      const speaker = msg.speakerName || conversation.npcName;
      messages.push({
        role: "assistant",
        content: `${speaker}: ${msg.text}`,
      });
    }
  }

  return messages;
}
