import { NextResponse } from "next/server";
import { generateDebrief } from "@/core/debrief";
import { createLogger, withConversationId } from "@/core/logger";
import { buildProgressEntry } from "@/core/progress";
import { buildSceneImagePrompt } from "@/core/scene";
import { idParamSchema, quitConversationResponseSchema } from "@/core/types";
import { generateSceneImage } from "@/infra/image";
import { getSessionId } from "@/infra/session";
import {
  addProgressEntry,
  deleteConversation,
  getConversation,
} from "@/infra/storage";

const log = createLogger("api:quit");

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rawParams = await params;
  const parsedParams = idParamSchema.safeParse(rawParams.id);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Invalid conversation id" },
      { status: 400 },
    );
  }
  const id = parsedParams.data;

  return withConversationId(id, async () => {
    const conversation = await getConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    try {
      log.info({ turns: conversation.turnCount }, "quitting conversation");
      const [debrief, finalImageUrl] = await Promise.all([
        generateDebrief(conversation, "quit"),
        generateSceneImage(
          buildSceneImagePrompt({
            scenario: conversation.scenario,
            language: conversation.language,
            languageCode: conversation.languageCode,
            scenarioKey: conversation.scenarioKey,
            npcName: conversation.npcName,
            npcPersonality: conversation.npcPersonality,
            mood: conversation.mood,
            outcome: "quit",
          }),
        ),
      ]);

      const history = [...conversation.history];
      const npcName = conversation.npcName;

      // Save progress before deleting conversation
      conversation.debrief = debrief;
      const sessionId = await getSessionId();
      if (sessionId) {
        await addProgressEntry(buildProgressEntry(sessionId, conversation));
      }

      await deleteConversation(id);

      return NextResponse.json(
        quitConversationResponseSchema.parse({
          debrief,
          sceneImageUrl: finalImageUrl,
          npcName,
          goalStatus: "quit",
          conversationHistory: history,
        }),
      );
    } catch (error) {
      log.error({ err: error }, "failed to quit conversation");
      return NextResponse.json(
        { error: "Failed to generate debrief" },
        { status: 500 },
      );
    }
  });
}
