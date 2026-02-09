import { createLogger } from "@/core/logger";
import {
  type Conversation,
  type Debrief,
  debriefFromLlmSchema,
} from "@/core/types";
import { debriefApiSchema } from "@/core/types/llm-api";
import { generateStructured } from "@/infra/llm";
import { buildDebriefMetrics } from "./metrics";
import { buildDebriefSystemPrompt, buildDebriefUserPrompt } from "./prompts";

const log = createLogger("ai:debrief");

export async function generateDebrief(
  conversation: Conversation,
  finalStatus: "achieved" | "failed" | "quit",
): Promise<Debrief> {
  log.info({ finalStatus }, "generating debrief");
  const start = Date.now();
  const historyText = conversation.history
    .map(
      (m) => `${m.role === "user" ? "User" : conversation.npcName}: ${m.text}`,
    )
    .join("\n");

  const { object } = await generateStructured(debriefApiSchema, {
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

  const parsed = debriefFromLlmSchema.parse(object);
  const metrics = buildDebriefMetrics(conversation, finalStatus);

  log.info(
    {
      durationMs: Date.now() - start,
      keyPhraseCount: parsed.keyPhrases.length,
    },
    "debrief generated",
  );
  return {
    narrative: parsed.narrative,
    keyPhrases: parsed.keyPhrases,
    goalAchieved: finalStatus === "achieved",
    metrics,
  };
}
