import { getConversation, setConversation, setHints } from "@/lib/storage";
import { generateSceneImage, generateNpcResponseStream, generateDebrief } from "@/lib/ai";
import { getNpcFaceAssetUrl, applyNpcPolicy } from "@/lib/game";
import {
  type GoalStatus,
  idParamSchema,
  messageStreamCompletePayloadSchema,
  messageStreamErrorPayloadSchema,
  messageStreamTokenPayloadSchema,
  sendMessageSchema,
} from "@/lib/types";

const MAX_USER_TURNS = 15;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rawParams = await params;
  const parsedParams = idParamSchema.safeParse(rawParams.id);
  if (!parsedParams.success) {
    return new Response(
      formatSSE(
        "error",
        messageStreamErrorPayloadSchema.parse({ error: "Invalid conversation id" }),
      ),
      {
        status: 400,
        headers: sseHeaders(),
      },
    );
  }
  const id = parsedParams.data;
  const conversation = await getConversation(id);

  if (!conversation) {
    return new Response(
      formatSSE(
        "error",
        messageStreamErrorPayloadSchema.parse({ error: "Conversation not found" }),
      ),
      {
        status: 404,
        headers: sseHeaders(),
      },
    );
  }
  const currentGoalStatus = conversation.goalStatus ?? "ongoing";
  if (currentGoalStatus !== "ongoing") {
    return new Response(
      formatSSE(
        "error",
        messageStreamErrorPayloadSchema.parse({
          error: "Conversation has already ended",
        }),
      ),
      {
        status: 409,
        headers: sseHeaders(),
      },
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return new Response(
      formatSSE(
        "error",
        messageStreamErrorPayloadSchema.parse({ error: "Invalid JSON body" }),
      ),
      {
        status: 400,
        headers: sseHeaders(),
      },
    );
  }
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      formatSSE(
        "error",
        messageStreamErrorPayloadSchema.parse({ error: "Invalid input" }),
      ),
      {
        status: 400,
        headers: sseHeaders(),
      },
    );
  }

  const { message } = parsed.data;
  conversation.history.push({ role: "user", text: message });
  const previousTurnCount = Number.isFinite(conversation.turnCount)
    ? Number(conversation.turnCount)
    : 0;
  conversation.turnCount = previousTurnCount + 1;
  conversation.goalStatus = "ongoing";
  conversation.debrief = undefined;
  await setConversation(id, conversation);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const encoder = new TextEncoder();

        for await (const event of generateNpcResponseStream(conversation)) {
          if (event.type === "token") {
            controller.enqueue(
              encoder.encode(
                formatSSE(
                  "token",
                  messageStreamTokenPayloadSchema.parse({ text: event.text }),
                ),
              ),
            );
          } else if (event.type === "complete") {
            let npcResponse = applyNpcPolicy(conversation, event.data);
            const exceededTurnLimit =
              conversation.turnCount !== undefined &&
              conversation.turnCount >= MAX_USER_TURNS &&
              npcResponse.goalStatus === "ongoing";
            if (exceededTurnLimit) {
              npcResponse = {
                ...npcResponse,
                goalStatus: "failed",
                goalProgress: 1,
                mood: conversation.level === "beginner" ? "annoyed" : "skeptical",
                objective: {
                  ...npcResponse.objective,
                  objectiveMet: false,
                  objectiveScore: Math.min(npcResponse.objective.objectiveScore, 0.25),
                  blockers: Array.from(
                    new Set([
                      ...npcResponse.objective.blockers,
                      "turn_limit_reached",
                    ]),
                  ),
                },
                hints: [],
              };
            }

            const npcFaceImageUrl = getNpcFaceAssetUrl(
              conversation.scenarioKey ?? "__custom__",
              conversation.npcGender,
              npcResponse.mood,
            );

            conversation.history.push({
              role: "npc",
              text: npcResponse.npcMessage,
              mood: npcResponse.mood,
              npcFaceImageUrl,
            });
            conversation.mood = npcResponse.mood;
            conversation.goalProgress = npcResponse.goalProgress;
            conversation.npcFaceImageUrl = npcFaceImageUrl;
            conversation.evaluationHistory = [
              ...(conversation.evaluationHistory ?? []),
              npcResponse.evaluation,
            ];
            conversation.objectiveHistory = [
              ...(conversation.objectiveHistory ?? []),
              npcResponse.objective,
            ];

            await setHints(id, npcResponse.hints);

            if (npcResponse.goalStatus === "ongoing") {
              const moodPrompt = buildScenePrompt(conversation.scenario, npcResponse.mood);
              const sceneImageUrl = await generateSceneImageSafely(
                moodPrompt,
                conversation.sceneImageUrl,
              );
              conversation.sceneImageUrl = sceneImageUrl;
              conversation.messagesSinceImageRegen = 0;
              conversation.goalStatus = "ongoing";
              conversation.debrief = undefined;
              await setConversation(id, conversation);
              const completePayload = messageStreamCompletePayloadSchema.parse({
                npcMessage: npcResponse.npcMessage,
                mood: npcResponse.mood,
                goalStatus: npcResponse.goalStatus,
                goalProgress: npcResponse.goalProgress,
                evaluation: npcResponse.evaluation,
                objective: npcResponse.objective,
                hints: npcResponse.hints,
                sceneImageUrl,
                npcFaceImageUrl,
              });
              controller.enqueue(
                encoder.encode(
                  formatSSE("complete", completePayload),
                ),
              );
            } else {
              const finalStatus = npcResponse.goalStatus;
              const debrief = await generateDebrief(
                conversation,
                finalStatus,
              );
              const finalImagePrompt = buildScenePrompt(
                conversation.scenario,
                npcResponse.mood,
                finalStatus,
              );
              const finalImageUrl = await generateSceneImageSafely(
                finalImagePrompt,
                conversation.sceneImageUrl,
              );

              conversation.goalStatus = finalStatus;
              conversation.debrief = debrief;
              conversation.sceneImageUrl = finalImageUrl;
              conversation.messagesSinceImageRegen = 0;
              await setConversation(id, conversation);

              const completePayload = messageStreamCompletePayloadSchema.parse({
                npcMessage: npcResponse.npcMessage,
                mood: npcResponse.mood,
                goalStatus: npcResponse.goalStatus,
                goalProgress: npcResponse.goalProgress,
                evaluation: npcResponse.evaluation,
                objective: npcResponse.objective,
                hints: npcResponse.hints,
                sceneImageUrl: finalImageUrl,
                npcFaceImageUrl,
                debrief,
              });

              controller.enqueue(
                encoder.encode(
                  formatSSE("complete", completePayload),
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
          encoder.encode(
            formatSSE(
              "error",
              messageStreamErrorPayloadSchema.parse({ error: message }),
            ),
          ),
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

function buildScenePrompt(
  scenario: string,
  mood: string,
  outcome?: GoalStatus,
): string {
  const moodTone = describeMoodTone(mood);
  const outcomeTone =
    outcome === "achieved"
      ? "The scene should feel resolved and calmer than before."
      : outcome === "failed"
        ? "The scene should feel tense, unresolved, and emotionally heavy."
        : "";

  return [
    `Photorealistic background scene: ${scenario}.`,
    "No people, just the environment and setting. First-person perspective.",
    `Atmosphere: ${moodTone}.`,
    outcomeTone,
  ]
    .filter(Boolean)
    .join(" ");
}

function describeMoodTone(mood: string): string {
  switch (mood) {
    case "happy":
      return "uplifting and optimistic";
    case "friendly":
      return "welcoming and calm";
    case "neutral":
      return "balanced and realistic";
    case "skeptical":
      return "wary and uncertain";
    case "annoyed":
      return "frustrated and tense";
    case "angry":
      return "hostile and intense";
    case "sad":
      return "somber and subdued";
    case "surprised":
      return "suddenly tense and alert";
    default:
      return "balanced and realistic";
  }
}

async function generateSceneImageSafely(
  prompt: string,
  fallbackImageUrl: string,
): Promise<string> {
  try {
    return await generateSceneImage(prompt);
  } catch (error) {
    console.error("Scene image regeneration failed, using previous background.", error);
    return fallbackImageUrl;
  }
}
