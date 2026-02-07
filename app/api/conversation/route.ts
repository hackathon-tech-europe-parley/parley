import { NextResponse } from "next/server";
import { createConversationSchema } from "@/lib/types";
import type { Conversation } from "@/lib/types";
import { generateId, setConversation, setHints } from "@/lib/conversations";
import { generateSceneImage } from "@/lib/fal";
import { generateNpcProfile, generateNpcOpening } from "@/lib/openai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { scenario, language, level, goal } = parsed.data;
    const conversationId = generateId();

    const imagePrompt = `Photorealistic scene: ${scenario}. First-person perspective. Cinematic lighting.`;

    const [sceneImageUrl, npcProfile] = await Promise.all([
      generateSceneImage(imagePrompt),
      generateNpcProfile(scenario, language),
    ]);

    const conversation: Conversation = {
      scenario,
      language,
      level,
      goal,
      npcName: npcProfile.name,
      npcPersonality: npcProfile.personality,
      mood: "neutral",
      history: [],
      messagesSinceImageRegen: 0,
      sceneImageUrl,
    };

    const opening = await generateNpcOpening(conversation);
    conversation.history.push({ role: "npc", text: opening.npcMessage });
    conversation.mood = opening.mood;

    setConversation(conversationId, conversation);
    setHints(conversationId, opening.hints);

    return NextResponse.json({
      conversationId,
      sceneImageUrl,
      npcName: npcProfile.name,
      npcOpeningMessage: opening.npcMessage,
      npcOpeningMood: opening.mood,
      hints: opening.hints,
      scenario,
      goal,
      language,
      level,
    });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
