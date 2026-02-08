import { getConversation, setConversation, setHints } from "@/lib/conversations";
import { generateSceneImage } from "@/lib/fal";
import { getNpcFaceAssetUrl, getSpecialPersonFaceAssetUrl, getPoliceOfficerType, getPoliceOfficerName } from "@/lib/npc-assets";
import { generateNpcResponseStream, generateSpecialPersonResponseStream } from "@/lib/openai";
import { generateDebrief } from "@/lib/openai";
import { applyNpcPolicy } from "@/lib/npc-policy";
import {
  idParamSchema,
  messageStreamCompletePayloadSchema,
  messageStreamErrorPayloadSchema,
  messageStreamTokenPayloadSchema,
  sendMessageSchema,
} from "@/lib/types";

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

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const encoder = new TextEncoder();

        // Determine who should respond based on context
        // If special person exists, check last speaker to alternate
        let shouldUseSpecialPerson = false;
        if (conversation.specialPerson) {
          const lastMessage = conversation.history[conversation.history.length - 1];
          if (lastMessage?.role === "user") {
            // Alternate: if last NPC message was from original NPC, use officer; otherwise use NPC
            const lastNpcMessage = [...conversation.history].reverse().find(msg => msg.role === "npc");
            shouldUseSpecialPerson = lastNpcMessage?.speakerName === conversation.npcName;
          } else if (lastMessage?.speakerName === conversation.npcName) {
            shouldUseSpecialPerson = true; // Last was NPC, now use officer
          } else if (lastMessage?.speakerName === conversation.specialPerson.name) {
            shouldUseSpecialPerson = false; // Last was officer, now use NPC
          } else {
            // Default: use officer if available
            shouldUseSpecialPerson = true;
          }
        }

        // Use special person or regular NPC based on context
        const responseStream = (conversation.specialPerson && shouldUseSpecialPerson)
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
            const npcResponse = applyNpcPolicy(conversation, event.data);

            // Check if NPC message contains any mention of police (in any language)
            // Normalize the message to handle accents and variations
            const npcMessageLower = npcResponse.npcMessage.toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, ""); // Remove accents for matching
            const npcMessageOriginal = npcResponse.npcMessage.toLowerCase();
            
            const mentionsCallingPolice = !conversation.specialPerson && (
              npcMessageLower.includes("policia") || // Matches both "policía" and "policia" after normalization
              npcMessageOriginal.includes("policía") ||
              npcMessageOriginal.includes("policia") ||
              npcMessageLower.includes("police") ||
              npcMessageLower.includes("polizei") ||
              npcMessageLower.includes("officer") ||
              npcMessageLower.includes("oficial")
            );

            // Check if NPC wants to call the police (flag OR text detection)
            const shouldCallPoliceman = !conversation.specialPerson && (
              npcResponse.shouldCallPoliceman === true || mentionsCallingPolice
            );

            // Determine if this response is from special person or regular NPC
            // This should match what we determined at the start of the stream
            const isSpecialPerson = conversation.specialPerson && shouldUseSpecialPerson;
            
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

            await setHints(id, npcResponse.hints);

            let sceneImageUrl = conversation.sceneImageUrl;
            if (conversation.messagesSinceImageRegen >= 3) {
              const moodPrompt = `Photorealistic background scene: ${conversation.scenario}. No people, just the environment and setting. First-person perspective.`;
              sceneImageUrl = await generateSceneImage(moodPrompt);
              conversation.sceneImageUrl = sceneImageUrl;
              conversation.messagesSinceImageRegen = 0;
            }

            await setConversation(id, conversation);

            // Send NPC's complete event FIRST
            if (npcResponse.goalStatus === "ongoing") {
              const completePayload = messageStreamCompletePayloadSchema.parse({
                npcMessage: npcResponse.npcMessage,
                mood: npcResponse.mood,
                goalStatus: npcResponse.goalStatus,
                goalProgress: npcResponse.goalProgress,
                hints: npcResponse.hints,
                sceneImageUrl,
                npcFaceImageUrl: faceImageUrl,
                speakerName,
              });
              controller.enqueue(
                encoder.encode(
                  formatSSE("complete", completePayload),
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
                  ? `Photorealistic background scene: ${conversation.scenario}. No people, just the environment and setting. First-person perspective.`
                  : `Photorealistic background scene: ${conversation.scenario}. No people, just the environment and setting. First-person perspective.`;
              const finalImageUrl =
                await generateSceneImage(finalImagePrompt);

              const completePayload = messageStreamCompletePayloadSchema.parse({
                npcMessage: npcResponse.npcMessage,
                mood: npcResponse.mood,
                goalStatus: npcResponse.goalStatus,
                goalProgress: npcResponse.goalProgress,
                hints: npcResponse.hints,
                sceneImageUrl: finalImageUrl,
                npcFaceImageUrl: faceImageUrl,
                speakerName,
                debrief,
              });

              controller.enqueue(
                encoder.encode(
                  formatSSE("complete", completePayload),
                ),
              );
            }

            // If NPC indicated they want to call police, IMMEDIATELY generate and send police officer's introduction
            // This happens right after the NPC's complete event is sent
            if (shouldCallPoliceman) {
              console.log("[POLICE] Triggering police call. Message:", npcResponse.npcMessage.substring(0, 100));
              console.log("[POLICE] Mentions police:", mentionsCallingPolice, "Flag:", npcResponse.shouldCallPoliceman);
              
              // Use opposite gender: if NPC is man, use policewoman; if NPC is woman, use policeman
              const specialPersonType = getPoliceOfficerType(conversation.npcGender);
              const specialPersonName = getPoliceOfficerName(specialPersonType);
              const initialMood = "neutral";
              
              conversation.specialPerson = {
                name: specialPersonName,
                type: specialPersonType,
                mood: initialMood,
                faceImageUrl: getSpecialPersonFaceAssetUrl(specialPersonType, initialMood),
              };

              await setConversation(id, conversation);

              // Generate police officer's introduction message
              const policemanIntroStream = generateSpecialPersonResponseStream(
                conversation,
                specialPersonType,
                specialPersonName,
              );

              // Stream the introduction message immediately
              let introText = "";
              let introMood = initialMood;
              
              for await (const introEvent of policemanIntroStream) {
                if (introEvent.type === "token") {
                  introText += introEvent.text;
                  controller.enqueue(
                    encoder.encode(
                      formatSSE(
                        "token",
                        messageStreamTokenPayloadSchema.parse({ text: introEvent.text }),
                      ),
                    ),
                  );
                } else if (introEvent.type === "complete") {
                  introMood = introEvent.data.mood;
                  introText = introEvent.data.npcMessage;
                  
                  const introFaceUrl = getSpecialPersonFaceAssetUrl(specialPersonType, introMood);
                  conversation.specialPerson!.mood = introMood;
                  conversation.specialPerson!.faceImageUrl = introFaceUrl;
                  
                  conversation.history.push({
                    role: "npc",
                    text: introText,
                    mood: introMood,
                    npcFaceImageUrl: introFaceUrl,
                    speakerName: specialPersonName,
                  });
                  
                  await setConversation(id, conversation);
                  
                  // Send complete event for police officer's introduction
                  const introPayload = messageStreamCompletePayloadSchema.parse({
                    npcMessage: introText,
                    mood: introMood,
                    goalStatus: "ongoing",
                    goalProgress: conversation.goalProgress,
                    hints: [],
                    sceneImageUrl: conversation.sceneImageUrl,
                    npcFaceImageUrl: introFaceUrl,
                    speakerName: specialPersonName,
                  });
                  
                  controller.enqueue(
                    encoder.encode(
                      formatSSE("complete", introPayload),
                    ),
                  );
                }
              }
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
