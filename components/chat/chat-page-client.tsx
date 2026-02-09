"use client";

import confetti from "canvas-confetti";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { AudioRecorder } from "@/lib/audio/audio-recorder";
import { TTSPlayer } from "@/lib/audio/tts-player";
import { consumeSSE } from "@/lib/sse-client";
import {
  conversationCacheSchema,
  conversationSnapshotSchema,
  idParamSchema,
  type MessageStreamCompletePayload,
  messageStreamCompletePayloadSchema,
  type NpcGender,
  quitConversationResponseSchema,
  sttResponseSchema,
} from "@/lib/types";
import { ChatConversationView } from "./chat-conversation-view";
import { ChatDebriefView } from "./chat-debrief-view";
import {
  type ConversationState,
  type DebriefState,
  fromCachedConversation,
} from "./chat-types";

// Default TTS speed proportional to difficulty level:
// beginner=1.0, intermediate≈1.33, advanced≈1.67, impossible=2.0
const LEVEL_DEFAULT_SPEED: Record<string, number> = {
  beginner: 1.0,
  intermediate: 1.3,
  advanced: 1.7,
  impossible: 2.0,
};

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

  const [state, setState] = useState<ConversationState | null>(null);
  const [debriefState, setDebriefState] = useState<DebriefState | null>(null);
  const [endStatus, setEndStatus] = useState<DebriefState | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingTranscription, setPendingTranscription] = useState<
    string | null
  >(null);
  const [ttsPlaying, setTtsPlaying] = useState<number | null>(null);
  const [npcMuted, setNpcMuted] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [showJailBars, setShowJailBars] = useState(false);
  const hasSetLevelSpeed = useRef(false);

  const messagesEnd = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const ttsPlayerRef = useRef<TTSPlayer | null>(null);
  const hasAutoPlayed = useRef(false);
  const lastProcessedIndex = useRef(-1);

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

  // Set TTS speed based on difficulty level when state first loads
  useEffect(() => {
    if (state && !hasSetLevelSpeed.current) {
      hasSetLevelSpeed.current = true;
      const levelSpeed = LEVEL_DEFAULT_SPEED[state.level] ?? 1.0;
      setTtsSpeed(levelSpeed);
    }
  }, [state]);

  useEffect(() => {
    if (!conversationId) {
      setError("Invalid conversation id");
      return;
    }

    const cached = sessionStorage.getItem(`parley:${conversationId}`);
    if (cached) {
      sessionStorage.removeItem(`parley:${conversationId}`);
      try {
        const parsedRaw = JSON.parse(cached) as unknown;
        const parsed = conversationCacheSchema.safeParse(parsedRaw);
        if (parsed.success) {
          setState(fromCachedConversation(parsed.data));
          return;
        }
      } catch {
        // Fall through to API hydration.
      }
    }

    fetch(`/api/conversation/${conversationId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Conversation not found");
        }
        return response.json();
      })
      .then((data: unknown) => {
        const parsed = conversationSnapshotSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Malformed conversation payload");
        }
        const snapshot = parsed.data;
        setState({
          ...snapshot,
          evaluationHistory: snapshot.evaluationHistory ?? [],
          objectiveHistory: snapshot.objectiveHistory ?? [],
        });
        if (
          snapshot.goalStatus &&
          snapshot.goalStatus !== "ongoing" &&
          snapshot.debrief
        ) {
          setEndStatus({
            debrief: snapshot.debrief,
            sceneImageUrl: snapshot.sceneImageUrl,
            npcName: snapshot.npcName,
            goalStatus: snapshot.goalStatus,
          });
        } else {
          setEndStatus(null);
        }
      })
      .catch((fetchError) => setError(fetchError.message));
  }, [conversationId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional triggers for auto-scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.history, sending, endStatus]);

  useEffect(() => {
    ttsPlayerRef.current = new TTSPlayer();
    return () => {
      ttsPlayerRef.current?.dispose();
      ttsPlayerRef.current = null;
    };
  }, []);

  const autoPlayTts = useCallback(
    (
      text: string,
      messageIndex: number,
      langCode?: string,
      gender?: NpcGender,
      specialPersonType?: string,
      mood?: string,
    ) => {
      if (!ttsPlayerRef.current || ttsPlayerRef.current.muted) {
        return;
      }
      setTtsPlaying(messageIndex);
      // Determine TTS gender: use opposite of main NPC gender for police officer
      let ttsGender: NpcGender = gender || "feminine";
      if (specialPersonType) {
        // Police officer should have opposite voice of main character
        // If main NPC is feminine, police officer is masculine (policeman)
        // If main NPC is masculine, police officer is feminine (policewoman)
        // Use the main NPC's gender (passed as 'gender' parameter) to determine opposite
        const mainNpcGender = gender || "feminine";
        ttsGender = mainNpcGender === "masculine" ? "feminine" : "masculine";
      }
      ttsPlayerRef.current
        .play(text, `msg-${messageIndex}`, langCode, ttsGender, ttsSpeed, mood)
        .then(() => setTtsPlaying(null))
        .catch((playError) => {
          console.error("TTS autoplay failed:", playError);
          setTtsPlaying(null);
        });
    },
    [ttsSpeed],
  );

  useEffect(() => {
    if (state && lastProcessedIndex.current === -1) {
      lastProcessedIndex.current = state.history.length - 1;
    }
  }, [state]);

  useEffect(() => {
    if (state && state.history.length > 0 && !hasAutoPlayed.current) {
      if (state.history.length !== 1) {
        return;
      }
      hasAutoPlayed.current = true;
      const firstNpc = state.history[0];
      if (firstNpc?.role === "npc") {
        // Check if this is a special person message by comparing speakerName
        const isSpecialPerson =
          firstNpc.speakerName &&
          (firstNpc.speakerName === state.specialPerson?.name ||
            (firstNpc.speakerName === "Officer" &&
              firstNpc.speakerName !== state.npcName));
        const specialPersonType = isSpecialPerson
          ? state.specialPerson?.type || "policeman"
          : undefined;
        autoPlayTts(
          firstNpc.text,
          0,
          state.languageCode,
          state.npcGender,
          specialPersonType,
          firstNpc.mood ?? state.mood,
        );
        lastProcessedIndex.current = 0;
      }
    }
  }, [state, autoPlayTts]);

  useEffect(() => {
    if (!state || !state.history.length) {
      return;
    }

    const currentLastIndex = state.history.length - 1;
    if (currentLastIndex > lastProcessedIndex.current) {
      for (let i = lastProcessedIndex.current + 1; i <= currentLastIndex; i++) {
        const message = state.history[i];
        if (message?.role === "npc") {
          // Check if this is a special person message by comparing speakerName
          // This works even if state.specialPerson isn't set yet
          const isSpecialPerson =
            message.speakerName &&
            (message.speakerName === state.specialPerson?.name ||
              (message.speakerName === "Officer" &&
                message.speakerName !== state.npcName));
          const specialPersonType = isSpecialPerson
            ? state.specialPerson?.type || "policeman"
            : undefined;
          autoPlayTts(
            message.text,
            i,
            state.languageCode,
            state.npcGender,
            specialPersonType,
            message.mood ?? state.mood,
          );
        }
      }
      lastProcessedIndex.current = currentLastIndex;
    }
  }, [state, autoPlayTts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sendMessage is stable via useState/useRef
  useEffect(() => {
    if (pendingTranscription) {
      setPendingTranscription(null);
      void sendMessage(pendingTranscription);
    }
  }, [pendingTranscription]);

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

  function handleReplay(messageIndex: number, text: string) {
    const message = state?.history[messageIndex];
    // Check if this is a special person message by comparing speakerName
    const isSpecialPerson =
      message?.speakerName &&
      (message.speakerName === state?.specialPerson?.name ||
        (message.speakerName === "Officer" &&
          message.speakerName !== state?.npcName));
    const specialPersonType = isSpecialPerson
      ? state?.specialPerson?.type || "policeman"
      : undefined;
    autoPlayTts(
      text,
      messageIndex,
      state?.languageCode,
      state?.npcGender,
      specialPersonType,
      message?.mood ?? state?.mood,
    );
  }

  function handleSpeedChange(speed: number) {
    setTtsSpeed(speed);
  }

  function handleMuteToggle() {
    const next = !npcMuted;
    setNpcMuted(next);
    if (ttsPlayerRef.current) {
      ttsPlayerRef.current.muted = next;
    }
    if (next) setTtsPlaying(null);
  }

  function handleEndStatusClick() {
    if (!endStatus) return;
    if (endStatus.goalStatus === "achieved") {
      router.push("/");
    } else {
      setDebriefState(endStatus);
    }
  }

  async function handleMicToggle() {
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const recorder = recorderRef.current;
        if (!recorder) return;
        const audioBase64 = await recorder.stop();
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: audioBase64,
            languageCode: state?.languageCode,
          }),
        });
        if (!res.ok) {
          throw new Error("Transcription failed");
        }
        const data = sttResponseSchema.safeParse(await res.json());
        if (!data.success) {
          throw new Error("Malformed transcription payload");
        }
        if (data.data.text) {
          setPendingTranscription(data.data.text);
        }
      } catch (toggleError) {
        setError(
          toggleError instanceof Error
            ? toggleError.message
            : "Transcription failed",
        );
      } finally {
        setTranscribing(false);
      }
      return;
    }

    // Start recording — stop any NPC audio to avoid overlap
    ttsPlayerRef.current?.stop();
    setTtsPlaying(null);
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }
      await recorderRef.current.start();
      setRecording(true);
      setError(null);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Microphone access denied",
      );
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
          tDebrief={tDebrief}
          onClose={() => setDebriefState(null)}
        />
      )}
    </>
  );
}
