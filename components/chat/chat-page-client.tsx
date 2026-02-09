"use client";

import confetti from "canvas-confetti";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  idParamSchema,
  type MessageStreamCompletePayload,
  messageStreamCompletePayloadSchema,
  type NpcGender,
  quitConversationResponseSchema,
} from "@/core/types";
import { Link, useRouter } from "@/i18n/navigation";
import { ChatConversationView } from "./chat-conversation-view";
import { ChatDebriefView } from "./chat-debrief-view";
import type { DebriefState } from "./chat-types";
import { useAudioRecording } from "./hooks/use-audio-recording";
import { useConversationHydration } from "./hooks/use-conversation-hydration";
import { useTtsAutoPlay } from "./hooks/use-tts-auto-play";
import { consumeSSE } from "./lib/sse-client";

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export function ChatPageClient() {
  const params = useParams<{ id?: string }>();
  const parsedId = idParamSchema.safeParse(params.id);
  const conversationId = parsedId.success ? parsedId.data : null;

  const router = useRouter();
  const t = useTranslations("Chat");
  const tDebrief = useTranslations("Debrief");
  const tLevels = useTranslations("Levels");
  const tLangs = useTranslations("Languages");
  const tScenarios = useTranslations("Scenarios");

  const { state, setState, endStatus, setEndStatus, error, setError } =
    useConversationHydration(conversationId);

  const [debriefState, setDebriefState] = useState<DebriefState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [showJailBars, setShowJailBars] = useState(false);

  const messagesEnd = useRef<HTMLDivElement>(null);

  const {
    ttsPlayerRef,
    ttsPlaying,
    setTtsPlaying,
    ttsSpeed,
    npcMuted,
    lastProcessedIndex,
    handleReplay,
    handleSpeedChange,
    handleMuteToggle,
  } = useTtsAutoPlay(state);

  const { recording, transcribing, handleMicToggle } = useAudioRecording(
    state?.languageCode,
    ttsPlayerRef,
    setTtsPlaying,
    setError,
    (text: string) => {
      void sendMessage(text);
    },
  );

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional triggers for auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.history, sending, endStatus]);

  // Fire confetti burst when goal is achieved
  useEffect(() => {
    if (endStatus?.goalStatus !== "achieved") return;
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#a855f7"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#a855f7"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [endStatus?.goalStatus]);

  function handleEndStatusClick() {
    if (!endStatus) return;
    if (endStatus.goalStatus === "achieved") {
      router.push(
        state?.languageCode
          ? { pathname: "/", query: { lang: state.languageCode } }
          : "/",
      );
    } else {
      setDebriefState(endStatus);
    }
  }

  async function sendMessage(text?: string) {
    if (!conversationId) {
      setError("Invalid conversation id");
      return;
    }

    const msg = text ?? input.trim();
    if (!msg || sending || !state || endStatus) {
      return;
    }

    setInput("");
    setSending(true);
    setError(null);

    setState((prev) =>
      prev
        ? {
            ...prev,
            history: [...prev.history, { role: "user", text: msg }],
            replySuggestions: [],
          }
        : prev,
    );

    try {
      const res = await fetch(`/api/conversation/${conversationId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const completeEvents: MessageStreamCompletePayload[] = [];

      await consumeSSE<MessageStreamCompletePayload>(
        res,
        {
          onToken() {
            // Tokens are consumed but not displayed — we show a typing indicator instead
          },
          onComplete(data) {
            completeEvents.push(data);
          },
          onError(streamError) {
            setError(streamError);
          },
        },
        messageStreamCompletePayloadSchema,
      );

      // Police sequence: NPC speaks → 1s pause → 3s siren → police speaks
      const hasPoliceIntro =
        completeEvents.length >= 2 &&
        completeEvents[completeEvents.length - 1].policeIntroAudioUrl;

      if (hasPoliceIntro) {
        const npcData = completeEvents[0];
        const policeData = completeEvents[completeEvents.length - 1];
        const npcMsgIndex = state.history.length + 1;
        const policeMsgIndex = state.history.length + 2;

        // Prevent auto-play effects from triggering — we handle audio manually
        lastProcessedIndex.current = state.history.length + 2;

        // Prefetch all assets in parallel
        const preloads: Promise<void>[] = [];
        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          preloads.push(
            ttsPlayerRef.current.prefetch(
              npcData.npcMessage,
              `msg-${npcMsgIndex}`,
              state.languageCode,
              state.npcGender,
              ttsSpeed,
              npcData.mood,
            ),
          );
          if (policeData.policeIntroAudioUrl) {
            preloads.push(
              ttsPlayerRef.current.prefetchFromUrl(
                policeData.policeIntroAudioUrl,
                `msg-${policeMsgIndex}`,
                ttsSpeed,
              ),
            );
          }
        }
        if (
          npcData.sceneImageUrl &&
          npcData.sceneImageUrl !== state.sceneImageUrl
        ) {
          preloads.push(preloadImage(npcData.sceneImageUrl));
        }
        if (npcData.npcFaceImageUrl)
          preloads.push(preloadImage(npcData.npcFaceImageUrl));
        if (policeData.npcFaceImageUrl)
          preloads.push(preloadImage(policeData.npcFaceImageUrl));
        await Promise.all(preloads);

        // Step 1: Show NPC message and play TTS
        setState((prev) => {
          if (!prev) return prev;
          const resolvedFaceUrl =
            npcData.npcFaceImageUrl || prev.npcFaceImageUrl;
          const speakerName = npcData.speakerName || prev.npcName;
          return {
            ...prev,
            history: [
              ...prev.history,
              {
                role: "npc" as const,
                text: npcData.npcMessage,
                mood: npcData.mood,
                npcFaceImageUrl: resolvedFaceUrl,
                speakerName,
              },
            ],
            mood: npcData.mood,
            goalProgress: npcData.goalProgress,
            goalStatus: npcData.goalStatus,
            replySuggestions: npcData.replySuggestions,
            evaluationHistory: [...prev.evaluationHistory, npcData.evaluation],
            objectiveHistory: [...prev.objectiveHistory, npcData.objective],
            sceneImageUrl: npcData.sceneImageUrl,
            npcFaceImageUrl: resolvedFaceUrl,
          };
        });

        setSending(false);

        // Play NPC TTS and wait for it to finish
        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          setTtsPlaying(npcMsgIndex);
          try {
            await ttsPlayerRef.current.play(
              npcData.npcMessage,
              `msg-${npcMsgIndex}`,
              state.languageCode,
              state.npcGender,
              ttsSpeed,
              npcData.mood,
            );
          } catch {
            /* TTS failed, continue sequence */
          }
          setTtsPlaying(null);
        }

        // 1 second pause
        await new Promise((r) => setTimeout(r, 1000));

        // Play police siren (use TTSPlayer for autoplay permission)
        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          try {
            await ttsPlayerRef.current.playUrl(
              "/assets/special/police_siren.mp3",
              "sfx-siren",
            );
          } catch {
            /* siren blocked, continue */
          }
        } else {
          await new Promise((r) => setTimeout(r, 3000));
        }

        // Step 4: Show police intro and play TTS
        setState((prev) => {
          if (!prev) return prev;
          const resolvedFaceUrl =
            policeData.npcFaceImageUrl || prev.npcFaceImageUrl;
          const speakerName = policeData.speakerName || "Officer";
          const policeType =
            prev.npcGender === "masculine" ? "policewoman" : "policeman";
          return {
            ...prev,
            history: [
              ...prev.history,
              {
                role: "npc" as const,
                text: policeData.npcMessage,
                mood: policeData.mood,
                npcFaceImageUrl: resolvedFaceUrl,
                speakerName,
              },
            ],
            goalStatus: policeData.goalStatus,
            goalProgress: policeData.goalProgress,
            debrief: policeData.debrief,
            replySuggestions: policeData.replySuggestions,
            evaluationHistory: [
              ...prev.evaluationHistory,
              policeData.evaluation,
            ],
            objectiveHistory: [...prev.objectiveHistory, policeData.objective],
            sceneImageUrl: policeData.sceneImageUrl,
            specialPerson: {
              name: speakerName,
              type: policeType,
              mood: policeData.mood,
              faceImageUrl: resolvedFaceUrl,
            },
          };
        });

        // Play police TTS manually and wait for it to finish
        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          const policeGender: NpcGender =
            state.npcGender === "masculine" ? "feminine" : "masculine";
          setTtsPlaying(policeMsgIndex);
          try {
            await ttsPlayerRef.current.play(
              policeData.npcMessage,
              `msg-${policeMsgIndex}`,
              state.languageCode,
              policeGender,
              ttsSpeed,
              policeData.mood,
            );
          } catch {
            /* TTS failed, continue */
          }
          setTtsPlaying(null);
        }

        // Jail bars: sound + drop animation (CSS animation = 5s: 2s drop, 2s hold, 1s fade)
        setShowJailBars(true);
        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          try {
            await ttsPlayerRef.current.playUrl(
              "/assets/special/jail_bars.mp3",
              "sfx-jail-bars",
            );
          } catch {
            /* blocked, continue */
          }
        } else {
          await new Promise((r) => setTimeout(r, 3000));
        }
        // Wait for the CSS fade-out to complete (sound ~3s, animation needs 2s more to fade)
        await new Promise((r) => setTimeout(r, 2000));
        setShowJailBars(false);

        // Show debrief screen
        if (policeData.debrief) {
          setEndStatus({
            debrief: policeData.debrief,
            sceneImageUrl: policeData.sceneImageUrl,
            npcName: state.npcName,
            goalStatus: policeData.goalStatus,
          });
        }
      } else if (completeEvents.length > 0) {
        // Normal single-message flow
        const data = completeEvents[completeEvents.length - 1];
        const npcMsgIndex = state.history.length + 1;
        const cacheKey = `msg-${npcMsgIndex}`;

        const preloads: Promise<void>[] = [];

        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          // Determine TTS gender: use opposite of main NPC gender for police officer
          let ttsGender: NpcGender = state.npcGender || "feminine";
          const isSpecialPersonMessage =
            data.speakerName &&
            (data.speakerName === state.specialPerson?.name ||
              (data.speakerName === "Officer" &&
                data.speakerName !== state.npcName));
          if (isSpecialPersonMessage) {
            ttsGender =
              state.npcGender === "masculine" ? "feminine" : "masculine";
          }
          preloads.push(
            ttsPlayerRef.current.prefetch(
              data.npcMessage,
              cacheKey,
              state.languageCode,
              ttsGender,
              ttsSpeed,
              data.mood,
            ),
          );
        }
        if (data.sceneImageUrl && data.sceneImageUrl !== state.sceneImageUrl) {
          preloads.push(preloadImage(data.sceneImageUrl));
        }
        if (
          data.npcFaceImageUrl &&
          data.npcFaceImageUrl !== state.npcFaceImageUrl
        ) {
          preloads.push(preloadImage(data.npcFaceImageUrl));
        }

        await Promise.all(preloads);

        setState((prev) => {
          if (!prev) return prev;
          const resolvedFaceUrl = data.npcFaceImageUrl || prev.npcFaceImageUrl;
          const speakerName =
            data.speakerName ||
            (prev.specialPerson &&
            data.npcFaceImageUrl === prev.specialPerson.faceImageUrl
              ? prev.specialPerson.name
              : prev.npcName);
          const isSpecialPersonMessage =
            speakerName === prev.specialPerson?.name;
          const updatedSpecialPerson =
            isSpecialPersonMessage && prev.specialPerson
              ? {
                  ...prev.specialPerson,
                  mood: data.mood,
                  faceImageUrl: resolvedFaceUrl,
                }
              : prev.specialPerson;

          return {
            ...prev,
            history: [
              ...prev.history,
              {
                role: "npc" as const,
                text: data.npcMessage,
                mood: data.mood,
                npcFaceImageUrl: resolvedFaceUrl,
                speakerName,
              },
            ],
            mood: isSpecialPersonMessage ? prev.mood : data.mood,
            goalProgress: data.goalProgress,
            goalStatus: data.goalStatus,
            debrief: data.debrief,
            replySuggestions: data.replySuggestions,
            evaluationHistory: [...prev.evaluationHistory, data.evaluation],
            objectiveHistory: [...prev.objectiveHistory, data.objective],
            sceneImageUrl: data.sceneImageUrl,
            npcFaceImageUrl: isSpecialPersonMessage
              ? prev.npcFaceImageUrl
              : resolvedFaceUrl,
            specialPerson: updatedSpecialPerson,
          };
        });
        if (data.debrief) {
          setEndStatus({
            debrief: data.debrief,
            sceneImageUrl: data.sceneImageUrl,
            npcName: state.npcName,
            goalStatus: data.goalStatus,
          });
        }
      }
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleQuit() {
    if (!conversationId) {
      setError("Invalid conversation id");
      return;
    }

    if (quitting || !state) {
      return;
    }

    setQuitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/conversation/${conversationId}/quit`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to quit");
      }
      const parsed = quitConversationResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error("Malformed quit payload");
      }
      const data = parsed.data;
      setEndStatus({
        debrief: data.debrief,
        sceneImageUrl: data.sceneImageUrl,
        npcName: data.npcName,
        goalStatus: data.goalStatus,
      });
    } catch (quitError) {
      setError(
        quitError instanceof Error ? quitError.message : "Failed to quit",
      );
      setQuitting(false);
    }
  }

  if (error && !state) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="animate-in rounded-xl border border-red-800/30 bg-red-900/30 p-8 text-center">
          <p className="text-red-300">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-400 transition-colors hover:text-blue-300"
          >
            {t("backToSetup")}
          </Link>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
      </main>
    );
  }

  return (
    <>
      <ChatConversationView
        state={state}
        input={input}
        sending={sending}
        quitting={quitting}
        recording={recording}
        transcribing={transcribing}
        ttsPlaying={ttsPlaying}
        npcMuted={npcMuted}
        endStatus={endStatus}
        error={error}
        t={t}
        tDebrief={tDebrief}
        tLevels={tLevels}
        tLangs={tLangs}
        tScenarios={tScenarios}
        messagesEndRef={messagesEnd}
        onReplay={handleReplay}
        onChoiceSelect={(choice: string) => {
          void sendMessage(choice);
        }}
        onInputChange={setInput}
        onSubmit={() => {
          void sendMessage();
        }}
        onMicToggle={() => {
          void handleMicToggle();
        }}
        onMuteToggle={handleMuteToggle}
        ttsSpeed={ttsSpeed}
        onSpeedChange={handleSpeedChange}
        onEndStatusClick={handleEndStatusClick}
        onQuit={() => {
          void handleQuit();
        }}
      />
      {showJailBars && (
        <div className="fixed inset-0 z-50 pointer-events-none animate-jail-bars-drop">
          {/* biome-ignore lint/performance/noImgElement: Static asset */}
          <img
            src="/assets/special/jail_bars.png"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {debriefState && (
        <ChatDebriefView
          debriefState={debriefState}
          languageCode={state?.languageCode}
          tDebrief={tDebrief}
          onClose={() => setDebriefState(null)}
        />
      )}
    </>
  );
}
