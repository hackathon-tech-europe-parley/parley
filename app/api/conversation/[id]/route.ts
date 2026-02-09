import { NextResponse } from "next/server";
import { getConversation, getReplySuggestions } from "@/lib/storage";
import {
  conversationSnapshotSchema,
  idParamSchema,
  type ConversationSnapshot,
} from "@/lib/types";
import { createLogger, withConversationId } from "@/lib/logger";

const log = createLogger("api:conversation:get");

export async function GET(
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
      log.info("conversation not found");
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    log.info({ historyLength: conversation.history.length }, "conversation hydrated");
    const snapshot: ConversationSnapshot = {
      conversationId: id,
      scenario: conversation.scenario,
      language: conversation.language,
      level: conversation.level,
      goal: conversation.goal,
      npcName: conversation.npcName,
      mood: conversation.mood,
      goalProgress: conversation.goalProgress ?? 1,
      sceneImageUrl: conversation.sceneImageUrl,
      npcFaceImageUrl: conversation.npcFaceImageUrl,
      npcGender: conversation.npcGender,
      goalStatus: conversation.goalStatus ?? "ongoing",
      debrief: conversation.debrief,
      history: conversation.history,
      replySuggestions: await getReplySuggestions(id),
      evaluationHistory: conversation.evaluationHistory ?? [],
      objectiveHistory: conversation.objectiveHistory ?? [],
      scenarioKey: conversation.scenarioKey,
      languageCode: conversation.languageCode,
      specialPerson: conversation.specialPerson,
    };

    return NextResponse.json(conversationSnapshotSchema.parse(snapshot));
  });
}
