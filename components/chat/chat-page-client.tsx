"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AudioRecorder } from "@/lib/audio-recorder";
import { consumeSSE } from "@/lib/sse-client";
import { TTSPlayer } from "@/lib/tts-player";
import {
  conversationCacheSchema,
  conversationSnapshotSchema,
  idParamSchema,
  messageStreamCompletePayloadSchema,
  quitConversationResponseSchema,
  sttResponseSchema,
  type MessageStreamCompletePayload,
  type NpcGender,
} from "@/lib/types";
import { ChatConversationView } from "./chat-conversation-view";
import { ChatDebriefView } from "./chat-debrief-view";
import { fromCachedConversation, type ConversationState, type DebriefState } from "./chat-types";

export function ChatPageClient() {
  const params = useParams<{ id?: string }>();
  const parsedId = idParamSchema.safeParse(params.id);
  const conversationId = parsedId.success ? parsedId.data : null;

  const t = useTranslations("Chat");
  const tDebrief = useTranslations("Debrief");
  const tLevels = useTranslations("Levels");
  const tLangs = useTranslations("Languages");
  const tScenarios = useTranslations("Scenarios");

  const [state, setState] = useState<ConversationState | null>(null);
  const [debriefState, setDebriefState] = useState<DebriefState | null>(null);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [sending, setSending] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingTranscription, setPendingTranscription] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<number | null>(null);

  const messagesEnd = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const ttsPlayerRef = useRef<TTSPlayer | null>(null);
  const hasAutoPlayed = useRef(false);
  const lastProcessedIndex = useRef(-1);

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
        setState(parsed.data);
      })
      .catch((fetchError) => setError(fetchError.message));
  }, [conversationId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.history, streamingText]);

  useEffect(() => {
    ttsPlayerRef.current = new TTSPlayer();
    return () => {
      ttsPlayerRef.current?.dispose();
      ttsPlayerRef.current = null;
    };
  }, []);

  const autoPlayTts = useCallback(
    (text: string, messageIndex: number, langCode?: string, gender?: NpcGender) => {
      if (!ttsPlayerRef.current) {
        return;
      }
      setTtsPlaying(messageIndex);
      ttsPlayerRef.current
        .play(text, `msg-${messageIndex}`, langCode, gender)
        .then(() => setTtsPlaying(null))
        .catch((playError) => {
          console.error("TTS autoplay failed:", playError);
          setTtsPlaying(null);
        });
    },
    [],
  );

  useEffect(() => {
    if (state && lastProcessedIndex.current === -1) {
      lastProcessedIndex.current = state.history.length - 1;
    }
  }, [state]);

  useEffect(() => {
    if (state && state.history.length > 0 && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      const firstNpc = state.history[0];
      if (firstNpc?.role === "npc") {
        autoPlayTts(firstNpc.text, 0, state.languageCode, state.npcGender);
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
          autoPlayTts(message.text, i, state.languageCode, state.npcGender);
        }
      }
      lastProcessedIndex.current = currentLastIndex;
    }
  }, [state?.history.length, state, autoPlayTts]);

  useEffect(() => {
    if (pendingTranscription) {
      setPendingTranscription(null);
      void sendMessage(pendingTranscription);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTranscription]);

  function handleReplay(messageIndex: number, text: string) {
    autoPlayTts(text, messageIndex, state?.languageCode, state?.npcGender);
  }

  async function handleMicToggle() {
    if (recording) {
      setRecording(false);
      setTranscribing(true);
      try {
        const audioBase64 = await recorderRef.current!.stop();
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: audioBase64, languageCode: state?.languageCode }),
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
        setError(toggleError instanceof Error ? toggleError.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }
      await recorderRef.current.start();
      setRecording(true);
      setError(null);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Microphone access denied");
    }
  }

  async function sendMessage(text?: string) {
    if (!conversationId) {
      setError("Invalid conversation id");
      return;
    }

    const msg = text ?? input.trim();
    if (!msg || sending || !state) {
      return;
    }

    setInput("");
    setSending(true);
    setStreamingText("");
    setError(null);

    setState((prev) =>
      prev
        ? {
            ...prev,
            history: [...prev.history, { role: "user", text: msg }],
            hints: [],
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

      await consumeSSE<MessageStreamCompletePayload>(
        res,
        {
          onToken(token) {
            setStreamingText((prev) => prev + token);
          },
          onComplete(data) {
            setStreamingText("");
            setState((prev) => {
              if (!prev) {
                return prev;
              }
              const newHistory = [...prev.history, { role: "npc" as const, text: data.npcMessage }];
              return {
                ...prev,
                history: newHistory,
                mood: data.mood,
                goalProgress: data.goalProgress,
                hints: data.hints,
                sceneImageUrl: data.sceneImageUrl,
                npcFaceImageUrl: data.npcFaceImageUrl || prev.npcFaceImageUrl,
              };
            });
            if (data.debrief) {
              setDebriefState({
                debrief: data.debrief,
                sceneImageUrl: data.sceneImageUrl,
                npcName: state.npcName,
                goalStatus: data.goalStatus,
              });
            }
          },
          onError(streamError) {
            setError(streamError);
          },
        },
        messageStreamCompletePayloadSchema,
      );
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
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
      setDebriefState({
        debrief: data.debrief,
        sceneImageUrl: data.sceneImageUrl,
        npcName: data.npcName,
        goalStatus: data.goalStatus,
      });
    } catch (quitError) {
      setError(quitError instanceof Error ? quitError.message : "Failed to quit");
      setQuitting(false);
    }
  }

  if (error && !state) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="rounded-xl bg-red-900/50 p-8 text-center">
          <p className="text-red-300">{error}</p>
          <Link href="/" className="mt-4 inline-block text-blue-400 underline">
            {t("backToSetup")}
          </Link>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
      </main>
    );
  }

  if (debriefState) {
    return <ChatDebriefView debriefState={debriefState} tDebrief={tDebrief} />;
  }

  return (
    <ChatConversationView
      state={state}
      input={input}
      streamingText={streamingText}
      sending={sending}
      quitting={quitting}
      recording={recording}
      transcribing={transcribing}
      ttsPlaying={ttsPlaying}
      error={error}
      t={t}
      tLevels={tLevels}
      tLangs={tLangs}
      tScenarios={tScenarios}
      messagesEndRef={messagesEnd}
      onReplay={handleReplay}
      onHintSelect={setInput}
      onInputChange={setInput}
      onSubmit={() => {
        void sendMessage();
      }}
      onMicToggle={() => {
        void handleMicToggle();
      }}
      onQuit={() => {
        void handleQuit();
      }}
    />
  );
}
