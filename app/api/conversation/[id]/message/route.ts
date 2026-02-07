import { getConversation, setHints } from "@/lib/conversations";
import { generateSceneImage, updateNpcFaceImage } from "@/lib/fal";
import { generateNpcResponseStream } from "@/lib/openai";
import { generateDebrief } from "@/lib/openai";
import { sendMessageSchema } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversation = getConversation(id);

  if (!conversation) {
    return new Response(
      formatSSE("error", { error: "Conversation not found" }),
      {
        status: 404,
        headers: sseHeaders(),
      },
    );
  }

  const body = await request.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      formatSSE("error", { error: "Invalid input" }),
      {
        status: 400,
        headers: sseHeaders(),
      },
    );
  }

  const { message } = parsed.data;
  conversation.history.push({ role: "user", text: message });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const encoder = new TextEncoder();

        for await (const event of generateNpcResponseStream(conversation)) {
          if (event.type === "token") {
            controller.enqueue(
              encoder.encode(formatSSE("token", { text: event.text })),
            );
          } else if (event.type === "complete") {
            const npcResponse = event.data;
            conversation.history.push({
              role: "npc",
              text: npcResponse.npcMessage,
            });
            conversation.mood = npcResponse.mood;
            conversation.messagesSinceImageRegen++;

            setHints(id, npcResponse.hints);

            // Update NPC face image based on new mood
            let npcFaceImageUrl = conversation.npcFaceImageUrl;
            try {
              if (conversation.npcFaceImageUrl) {
                npcFaceImageUrl = await updateNpcFaceImage(
                  conversation.npcFaceImageUrl,
                  npcResponse.mood,
                  conversation.npcName,
                );
                conversation.npcFaceImageUrl = npcFaceImageUrl;
              }
            } catch (error) {
              console.error("Failed to update NPC face image:", error);
              // Continue with existing face image if update fails
            }

            let sceneImageUrl = conversation.sceneImageUrl;
            if (conversation.messagesSinceImageRegen >= 3) {
              const moodPrompt = `Photorealistic scene: ${conversation.scenario}. The person you're interacting with looks ${npcResponse.mood}. First-person perspective. Cinematic lighting.`;
              sceneImageUrl = await generateSceneImage(moodPrompt);
              conversation.sceneImageUrl = sceneImageUrl;
              conversation.messagesSinceImageRegen = 0;
            }

            if (npcResponse.goalStatus === "ongoing") {
              controller.enqueue(
                encoder.encode(
                  formatSSE("complete", {
                    npcMessage: npcResponse.npcMessage,
                    mood: npcResponse.mood,
                    goalStatus: npcResponse.goalStatus,
                    hints: npcResponse.hints,
                    sceneImageUrl,
                    npcFaceImageUrl,
                  }),
                ),
              );
            } else {
              // Goal achieved or failed — generate debrief
              const debrief = await generateDebrief(
                conversation,
                npcResponse.goalStatus,
              );
              const finalImagePrompt =
                npcResponse.goalStatus === "achieved"
                  ? `Photorealistic scene: ${conversation.scenario}. Happy resolution. First-person perspective. Cinematic lighting.`
                  : `Photorealistic scene: ${conversation.scenario}. Tense, unsuccessful interaction. First-person perspective. Cinematic lighting.`;
              const finalImageUrl =
                await generateSceneImage(finalImagePrompt);

              controller.enqueue(
                encoder.encode(
                  formatSSE("complete", {
                    npcMessage: npcResponse.npcMessage,
                    mood: npcResponse.mood,
                    goalStatus: npcResponse.goalStatus,
                    hints: npcResponse.hints,
                    sceneImageUrl: finalImageUrl,
                    debrief,
                  }),
                ),
              );
            }
          }
        }
      } catch (error) {
        const encoder = new TextEncoder();
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(formatSSE("error", { error: message })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
