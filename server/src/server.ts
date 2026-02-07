import { McpServer } from "skybridge/server";
import { z } from "zod";
import { generateSceneImage } from "./fal.js";
import { generateNpcResponse, generateDebrief, generateNpcProfile, generateNpcOpening } from "./openai.js";
import type { Conversation, NpcResponse } from "./types.js";

const conversations = new Map<string, Conversation>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const server = new McpServer(
  { name: "parley", version: "0.0.1" },
  { capabilities: {} },
)
  .registerWidget(
    "parley",
    {
      description: "Situational language learning through immersive roleplay. Generates a visual scene and lets the user practice a target language with an NPC to achieve a goal.",
      _meta: {
        ui: {
          csp: {
            resourceDomains: [
              "https://fal.media",
              "https://v3.fal.media",
            ],
          },
        },
      },
    },
    {
      inputSchema: {
        scenario: z.string().describe("A description of the real-life situation (e.g. 'You are in a taxi in Barcelona and want to negotiate the fare')"),
        language: z.string().describe("The target language to practice (e.g. 'Spanish', 'French')"),
        level: z.enum(["beginner", "intermediate", "advanced"]).describe("The user's proficiency level"),
        goal: z.string().describe("What the user is trying to achieve (e.g. 'Convince the driver to lower the fare')"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ scenario, language, level, goal }) => {
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

      // Generate NPC opening line so the widget is fully self-contained
      const opening = await generateNpcOpening(conversation);
      conversation.history.push({ role: "npc", text: opening.npcMessage });
      conversation.mood = opening.mood;

      conversations.set(conversationId, conversation);

      return {
        structuredContent: {
          phase: "setup" as const,
          conversationId,
          sceneImageUrl,
          npcName: npcProfile.name,
          npcPersonality: npcProfile.personality,
          npcOpeningMessage: opening.npcMessage,
          npcOpeningMood: opening.mood,
          npcOpeningHints: opening.hints,
          scenario,
          goal,
          language,
          level,
        },
        content: [
          {
            type: "text" as const,
            text: `Scene ready. The user will practice ${language} (${level} level) in this scenario: ${scenario}. Their goal: ${goal}. They are talking to ${npcProfile.name} who said: "${opening.npcMessage}". The user will interact with the NPC through the widget.`,
          },
        ],
      };
    },
  )
  .registerTool(
    "parley-message",
    {
      description: "Send a message in an active Parley conversation. The user speaks in the target language and the NPC responds.",
      inputSchema: {
        conversationId: z.string().describe("The conversation ID from parley widget setup"),
        message: z.string().describe("The user's message in the target language"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ conversationId, message }) => {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        return {
          structuredContent: { error: "Conversation not found" },
          content: [{ type: "text" as const, text: "Conversation not found. Please start a new scenario." }],
          isError: true,
        };
      }

      conversation.history.push({ role: "user", text: message });

      const npcResponse: NpcResponse = await generateNpcResponse(conversation);

      conversation.history.push({ role: "npc", text: npcResponse.npcMessage });
      conversation.mood = npcResponse.mood;
      conversation.messagesSinceImageRegen++;

      let sceneImageUrl = conversation.sceneImageUrl;
      if (conversation.messagesSinceImageRegen >= 3) {
        const moodPrompt = `Photorealistic scene: ${conversation.scenario}. The person you're interacting with looks ${npcResponse.mood}. First-person perspective. Cinematic lighting.`;
        sceneImageUrl = await generateSceneImage(moodPrompt);
        conversation.sceneImageUrl = sceneImageUrl;
        conversation.messagesSinceImageRegen = 0;
      }

      if (npcResponse.goalStatus === "ongoing") {
        return {
          structuredContent: {
            phase: "conversation" as const,
            conversationId,
            sceneImageUrl,
            npcName: conversation.npcName,
            npcMessage: npcResponse.npcMessage,
            mood: npcResponse.mood,
            hints: npcResponse.hints,
            conversationHistory: conversation.history,
            goalStatus: npcResponse.goalStatus,
          },
          content: [
            {
              type: "text" as const,
              text: `${conversation.npcName} (${npcResponse.mood}): "${npcResponse.npcMessage}". The conversation is ongoing. Wait for the user's next message.`,
            },
          ],
        };
      }

      // Goal achieved or failed - generate debrief
      const debrief = await generateDebrief(conversation, npcResponse.goalStatus);
      const finalImagePrompt = npcResponse.goalStatus === "achieved"
        ? `Photorealistic scene: ${conversation.scenario}. Happy resolution, warm atmosphere. First-person perspective. Cinematic lighting.`
        : `Photorealistic scene: ${conversation.scenario}. Tense, unsuccessful interaction. First-person perspective. Cinematic lighting.`;
      const finalImageUrl = await generateSceneImage(finalImagePrompt);

      conversations.delete(conversationId);

      return {
        structuredContent: {
          phase: "debrief" as const,
          conversationId,
          sceneImageUrl: finalImageUrl,
          npcName: conversation.npcName,
          goalStatus: npcResponse.goalStatus,
          debrief,
          conversationHistory: conversation.history,
        },
        content: [
          {
            type: "text" as const,
            text: `Conversation ended. Goal ${npcResponse.goalStatus}. ${debrief.narrative}`,
          },
        ],
      };
    },
  )
  .registerTool(
    "parley-quit",
    {
      description: "Quit an active Parley conversation early and get a debrief.",
      inputSchema: {
        conversationId: z.string().describe("The conversation ID"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ conversationId }) => {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        return {
          structuredContent: { error: "Conversation not found" },
          content: [{ type: "text" as const, text: "Conversation not found." }],
          isError: true,
        };
      }

      const debrief = await generateDebrief(conversation, "quit");
      const finalImageUrl = await generateSceneImage(
        `Photorealistic scene: ${conversation.scenario}. Person walking away. First-person perspective. Cinematic lighting.`
      );

      conversations.delete(conversationId);

      return {
        structuredContent: {
          phase: "debrief" as const,
          conversationId,
          sceneImageUrl: finalImageUrl,
          npcName: conversation.npcName,
          goalStatus: "quit" as const,
          debrief,
          conversationHistory: conversation.history,
        },
        content: [
          {
            type: "text" as const,
            text: `User quit the conversation. ${debrief.narrative}`,
          },
        ],
      };
    },
  );

export default server;
export type AppType = typeof server;
