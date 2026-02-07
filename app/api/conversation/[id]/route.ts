import { NextResponse } from "next/server";
import { getConversation, getHints } from "@/lib/conversations";
import type { ConversationSnapshot } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversation = getConversation(id);

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const snapshot: ConversationSnapshot = {
    conversationId: id,
    scenario: conversation.scenario,
    language: conversation.language,
    level: conversation.level,
    goal: conversation.goal,
    npcName: conversation.npcName,
    mood: conversation.mood,
    sceneImageUrl: conversation.sceneImageUrl,
    history: conversation.history,
    hints: getHints(id),
  };

  return NextResponse.json(snapshot);
}
