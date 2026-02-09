import {
  generateDebrief,
  generateNpcResponseStream,
  generateSceneImage,
  generateSpecialPersonResponseStream,
} from "@/lib/ai";
import {
  applyNpcPolicy,
  getNpcFaceAssetUrl,
  getPoliceCallingLine,
  getPoliceIntroMessage,
  getPoliceOfficerName,
  getPoliceOfficerType,
  getSpecialPersonFaceAssetUrl,
} from "@/lib/game";
import { createLogger, withConversationId } from "@/lib/logger";
import {
  getConversation,
  setConversation,
  setReplySuggestions,
} from "@/lib/storage";
import {
  type GoalStatus,
  idParamSchema,
  messageStreamCompletePayloadSchema,
  messageStreamErrorPayloadSchema,
  messageStreamTokenPayloadSchema,
  sendMessageSchema,
} from "@/lib/types";

const log = createLogger("api:message");

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
        messageStreamErrorPayloadSchema.parse({
          error: "Invalid conversation id",
        }),
      ),
      {
        status: 400,
        headers: sseHeaders(),
      },
    );
  }
  const id = parsedParams.data;

  return withConversationId(id, async () => {
    const conversation = await getConversation(id);

    if (!conversation) {
      return new Response(
        formatSSE(
          "error",
          messageStreamErrorPayloadSchema.parse({
            error: "Conversation not found",
          }),
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
    log.info({ turn: conversation.turnCount }, "message received");
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

          // Determine who should respond based on context
          // If special person exists, check last speaker to alternate
          let shouldUseSpecialPerson = false;
          if (conversation.specialPerson) {
            const lastMessage =
              conversation.history[conversation.history.length - 1];
            if (lastMessage?.role === "user") {
              // Alternate: if last NPC message was from original NPC, use officer; otherwise use NPC
              const lastNpcMessage = [...conversation.history]
                .reverse()
                .find((msg) => msg.role === "npc");
              shouldUseSpecialPerson =
                lastNpcMessage?.speakerName === conversation.npcName;
            } else if (lastMessage?.speakerName === conversation.npcName) {
              shouldUseSpecialPerson = true; // Last was NPC, now use officer
            } else if (
              lastMessage?.speakerName === conversation.specialPerson.name
            ) {
              shouldUseSpecialPerson = false; // Last was officer, now use NPC
            } else {
              // Default: use officer if available
              shouldUseSpecialPerson = true;
            }
          }

          // Use special person or regular NPC based on context
          const responseStream =
            conversation.specialPerson && shouldUseSpecialPerson
              ? generateSpecialPersonResponseStream(
                  conversation,
                  conversation.specialPerson.type,
                  conversation.specialPerson.name,
                )
              : generateNpcResponseStream(conversation);

          for await (const event of responseStream) {
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
                  mood:
                    conversation.level === "beginner" ? "annoyed" : "skeptical",
                  objective: {
                    ...npcResponse.objective,
                    objectiveMet: false,
                    objectiveScore: Math.min(
                      npcResponse.objective.objectiveScore,
                      0.25,
                    ),
                    blockers: Array.from(
                      new Set([
                        ...npcResponse.objective.blockers,
                        "turn_limit_reached",
                      ]),
                    ),
                  },
                  replySuggestions: [],
                };
              }

              // Check if NPC message contains any mention of police (in any language)
              // Normalize the message to handle accents and variations
              const npcMessageLower = npcResponse.npcMessage
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, ""); // Remove accents for matching
              const npcMessageOriginal = npcResponse.npcMessage.toLowerCase();

              const mentionsCallingPolice =
                !conversation.specialPerson &&
                (npcMessageLower.includes("policia") || // Matches both "policía" and "policia" after normalization
                  npcMessageOriginal.includes("policía") ||
                  npcMessageOriginal.includes("policia") ||
                  npcMessageLower.includes("police") ||
                  npcMessageLower.includes("polizei") ||
                  npcMessageLower.includes("officer") ||
                  npcMessageLower.includes("oficial"));

              // Check if NPC wants to call the police (flag OR text detection)
              const shouldCallPoliceman =
                !conversation.specialPerson &&
                (npcResponse.shouldCallPoliceman === true ||
                  mentionsCallingPolice);

              // If police is being called but tone enforcement stripped the mention, append it
              if (shouldCallPoliceman && !mentionsCallingPolice) {
                npcResponse = {
                  ...npcResponse,
                  npcMessage:
                    npcResponse.npcMessage +
                    " " +
                    getPoliceCallingLine(conversation.languageCode ?? "en"),
                };
              }

              // Police being called means the goal is failed
              if (shouldCallPoliceman) {
                npcResponse = {
                  ...npcResponse,
                  goalStatus: "failed",
                  goalProgress: 1,
                  objective: {
                    ...npcResponse.objective,
                    objectiveMet: false,
                    objectiveScore: Math.min(
                      npcResponse.objective.objectiveScore,
                      0.1,
                    ),
                    blockers: Array.from(
                      new Set([
                        ...npcResponse.objective.blockers,
                        "police_called",
                      ]),
                    ),
                  },
                  replySuggestions: [],
                };
              }

              // Determine if this response is from special person or regular NPC
              // This should match what we determined at the start of the stream
              const isSpecialPerson =
                conversation.specialPerson && shouldUseSpecialPerson;

              let faceImageUrl: string;
              let speakerName: string;

              if (isSpecialPerson && conversation.specialPerson) {
                // Special person response
                faceImageUrl = getSpecialPersonFaceAssetUrl(
                  conversation.specialPerson.type,
                  npcResponse.mood,
                );
                speakerName = conversation.specialPerson.name;
                conversation.specialPerson.mood = npcResponse.mood;
                conversation.specialPerson.faceImageUrl = faceImageUrl;
              } else {
                // Regular NPC response
                faceImageUrl = getNpcFaceAssetUrl(
                  conversation.scenarioKey ?? "__custom__",
                  conversation.npcGender,
                  npcResponse.mood,
                );
                speakerName = conversation.npcName;
                conversation.mood = npcResponse.mood;
                conversation.npcFaceImageUrl = faceImageUrl;
              }

              conversation.history.push({
                role: "npc",
                text: npcResponse.npcMessage,
                mood: npcResponse.mood,
                npcFaceImageUrl: faceImageUrl,
                speakerName,
              });
              conversation.goalProgress = npcResponse.goalProgress;
              conversation.messagesSinceImageRegen++;
              conversation.evaluationHistory = [
                ...(conversation.evaluationHistory ?? []),
                npcResponse.evaluation,
              ];
              conversation.objectiveHistory = [
                ...(conversation.objectiveHistory ?? []),
                npcResponse.objective,
              ];

              await setReplySuggestions(id, npcResponse.replySuggestions);

              // Send NPC's complete event FIRST
              if (shouldCallPoliceman) {
                // Police sequence: NPC message is "ongoing" for the client (debrief goes on police intro)
                const moodPrompt = buildScenePrompt(
                  conversation.scenario,
                  npcResponse.mood,
                );
                const sceneImageUrl = await generateSceneImageSafely(
                  moodPrompt,
                  conversation.sceneImageUrl,
                );
                conversation.sceneImageUrl = sceneImageUrl;
                conversation.messagesSinceImageRegen = 0;
                // Don't persist failed status yet — will be set after police intro
                await setConversation(id, conversation);

                const npcPayload = messageStreamCompletePayloadSchema.parse({
                  npcMessage: npcResponse.npcMessage,
                  mood: npcResponse.mood,
                  goalStatus: "ongoing",
                  goalProgress: npcResponse.goalProgress,
                  evaluation: npcResponse.evaluation,
                  objective: npcResponse.objective,
                  replySuggestions: [],
                  sceneImageUrl,
                  npcFaceImageUrl: faceImageUrl,
                  speakerName,
                });
                controller.enqueue(
                  encoder.encode(formatSSE("complete", npcPayload)),
                );

                // Generate debrief for the police intro payload
                log.info(
                  { flag: npcResponse.shouldCallPoliceman },
                  "triggering police call",
                );

                const debrief = await generateDebrief(conversation, "failed");

                const specialPersonType = getPoliceOfficerType(
                  conversation.npcGender,
                );
                const specialPersonName =
                  getPoliceOfficerName(specialPersonType);
                const introMood = "firm";
                const introFaceUrl = getSpecialPersonFaceAssetUrl(
                  specialPersonType,
                  introMood,
                );
                const introText = getPoliceIntroMessage(
                  conversation.languageCode ?? "en",
                );

                conversation.specialPerson = {
                  name: specialPersonName,
                  type: specialPersonType,
                  mood: introMood,
                  faceImageUrl: introFaceUrl,
                };
                conversation.goalStatus = "failed";
                conversation.debrief = debrief;

                conversation.history.push({
                  role: "npc",
                  text: introText,
                  mood: introMood,
                  npcFaceImageUrl: introFaceUrl,
                  speakerName: specialPersonName,
                });

                await setConversation(id, conversation);

                const langCode = conversation.languageCode ?? "en";
                const policeIntroAudioUrl = `/api/police-audio?type=${specialPersonType}&lang=${langCode}`;

                const introPayload = messageStreamCompletePayloadSchema.parse({
                  npcMessage: introText,
                  mood: introMood,
                  goalStatus: "failed",
                  goalProgress: 1,
                  evaluation: npcResponse.evaluation,
                  objective: npcResponse.objective,
                  replySuggestions: [],
                  sceneImageUrl: conversation.sceneImageUrl,
                  npcFaceImageUrl: introFaceUrl,
                  speakerName: specialPersonName,
                  policeIntroAudioUrl,
                  debrief,
                });

                controller.enqueue(
                  encoder.encode(formatSSE("complete", introPayload)),
                );
              } else if (npcResponse.goalStatus === "ongoing") {
                const moodPrompt = buildScenePrompt(
                  conversation.scenario,
                  npcResponse.mood,
                );
                const sceneImageUrl = await generateSceneImageSafely(
                  moodPrompt,
                  conversation.sceneImageUrl,
                );
                conversation.sceneImageUrl = sceneImageUrl;
                conversation.messagesSinceImageRegen = 0;
                conversation.goalStatus = "ongoing";
                conversation.debrief = undefined;
                await setConversation(id, conversation);
                const completePayload =
                  messageStreamCompletePayloadSchema.parse({
                    npcMessage: npcResponse.npcMessage,
                    mood: npcResponse.mood,
                    goalStatus: npcResponse.goalStatus,
                    goalProgress: npcResponse.goalProgress,
                    evaluation: npcResponse.evaluation,
                    objective: npcResponse.objective,
                    replySuggestions: npcResponse.replySuggestions,
                    sceneImageUrl,
                    npcFaceImageUrl: faceImageUrl,
                    speakerName,
                  });
                controller.enqueue(
                  encoder.encode(formatSSE("complete", completePayload)),
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

                const completePayload =
                  messageStreamCompletePayloadSchema.parse({
                    npcMessage: npcResponse.npcMessage,
                    mood: npcResponse.mood,
                    goalStatus: npcResponse.goalStatus,
                    goalProgress: npcResponse.goalProgress,
                    evaluation: npcResponse.evaluation,
                    objective: npcResponse.objective,
                    replySuggestions: npcResponse.replySuggestions,
                    sceneImageUrl: finalImageUrl,
                    npcFaceImageUrl: faceImageUrl,
                    speakerName,
                    debrief,
                  });

                controller.enqueue(
                  encoder.encode(formatSSE("complete", completePayload)),
                );
              }
            }
          }
        } catch (error) {
          log.error({ err: error }, "message stream error");
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
  });
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
    log.warn(
      { err: error },
      "scene image regeneration failed, using previous background",
    );
    return fallbackImageUrl;
  }
}
