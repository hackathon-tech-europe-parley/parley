import { NextResponse } from "next/server";
import {
  getConversation,
  deleteConversation,
} from "@/lib/conversations";
import { generateSceneImage } from "@/lib/fal";
import { generateDebrief } from "@/lib/openai";
import { idParamSchema, quitConversationResponseSchema } from "@/lib/types";

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
  const conversation = await getConversation(id);

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
        `Photorealistic background scene: ${conversation.scenario}. No people, just the environment and setting. First-person perspective.`,
      ),
    ]);

    const history = [...conversation.history];
    const npcName = conversation.npcName;
    await deleteConversation(id);

    return NextResponse.json(quitConversationResponseSchema.parse({
      debrief,
      sceneImageUrl: finalImageUrl,
      npcName,
      goalStatus: "quit",
      conversationHistory: history,
    }));
  } catch (error) {
    console.error("Failed to quit conversation:", error);
    return NextResponse.json(
      { error: "Failed to generate debrief" },
      { status: 500 },
    );
  }
}
