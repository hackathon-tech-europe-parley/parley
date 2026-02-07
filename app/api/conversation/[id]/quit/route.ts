import { NextResponse } from "next/server";
import {
  getConversation,
  deleteConversation,
} from "@/lib/conversations";
import { generateSceneImage } from "@/lib/fal";
import { generateDebrief } from "@/lib/openai";

export async function POST(
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

  try {
    const [debrief, finalImageUrl] = await Promise.all([
      generateDebrief(conversation, "quit"),
      generateSceneImage(
        `Photorealistic scene: ${conversation.scenario}. Person walking away. First-person perspective. Cinematic lighting.`,
      ),
    ]);

    const history = [...conversation.history];
    const npcName = conversation.npcName;
    deleteConversation(id);

    return NextResponse.json({
      debrief,
      sceneImageUrl: finalImageUrl,
      npcName,
      goalStatus: "quit",
      conversationHistory: history,
    });
  } catch (error) {
    console.error("Failed to quit conversation:", error);
    return NextResponse.json(
      { error: "Failed to generate debrief" },
      { status: 500 },
    );
  }
}
