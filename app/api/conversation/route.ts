import { NextResponse } from "next/server";
import { createConversationResponseSchema, createConversationSchema } from "@/lib/types";
import type { Conversation } from "@/lib/types";
import { generateId, setConversation, setHints, setReplySuggestions } from "@/lib/storage";
import { generateSceneImage, generateNpcProfile, generateNpcOpening } from "@/lib/ai";
import { getNpcFaceAssetUrl } from "@/lib/game";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body === null) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { scenario, language, level, goal, scenarioKey, languageCode } = parsed.data;
    const conversationId = generateId();

    const imagePrompt = `Photorealistic background scene: ${scenario}. No people, just the environment and setting. First-person perspective.`;

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
      npcGender: npcProfile.gender,
      mood: "neutral",
      goalProgress: 1,
      hostilityStreak: 0,
      disengagedStreak: 0,
      constructiveStreak: 0,
      history: [],
      evaluationHistory: [],
      objectiveHistory: [],
      messagesSinceImageRegen: 0,
      sceneImageUrl,
      npcFaceImageUrl: "", // Will be set after generating opening
      goalStatus: "ongoing",
      turnCount: 0,
      tabooStrike: 0,
      scenarioKey,
      languageCode,
    };

    const opening = await generateNpcOpening(conversation);
    const npcFaceImageUrl = getNpcFaceAssetUrl(scenarioKey ?? "__custom__", npcProfile.gender, opening.mood);

    conversation.history.push({
      role: "npc",
      text: opening.npcMessage,
      mood: opening.mood,
      npcFaceImageUrl,
    });
    conversation.mood = opening.mood;
    conversation.goalProgress = opening.goalProgress;
    conversation.npcFaceImageUrl = npcFaceImageUrl;

    await setConversation(conversationId, conversation);
    await setHints(conversationId, opening.hints);
    await setReplySuggestions(conversationId, opening.replySuggestions);

    return NextResponse.json(createConversationResponseSchema.parse({
      conversationId,
      sceneImageUrl,
      npcFaceImageUrl,
      npcName: npcProfile.name,
      npcGender: npcProfile.gender,
      npcOpeningMessage: opening.npcMessage,
      npcOpeningMood: opening.mood,
      npcOpeningGoalProgress: opening.goalProgress,
      hints: opening.hints,
      replySuggestions: opening.replySuggestions,
      scenario,
      goal,
      language,
      level,
    }));
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 },
    );
  }
}
