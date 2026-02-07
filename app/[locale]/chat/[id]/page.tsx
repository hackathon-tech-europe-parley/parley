"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { consumeSSE } from "@/lib/sse-client";
import { Link } from "@/i18n/navigation";
import { AudioRecorder } from "@/lib/audio-recorder";
import { TTSPlayer } from "@/lib/tts-player";
import type { ConversationMessage, Debrief } from "@/lib/types";

interface ConversationState {
  conversationId: string;
  scenario: string;
  language: string;
  level: string;
  goal: string;
  npcName: string;
  mood: string;
  sceneImageUrl: string;
  history: ConversationMessage[];
  hints: string[];
  scenarioKey?: string;
  languageCode?: string;
}

// Reverse mapping from English language names to codes
const LANGUAGE_CODE_MAP: Record<string, string> = {
  English: "en",
  French: "fr",
  German: "de",
  Spanish: "es",
  Portuguese: "pt",
};

interface DebriefState {
  debrief: Debrief;
  sceneImageUrl: string;
  npcName: string;
  goalStatus: string;
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
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

  // Hydrate from sessionStorage or API
  useEffect(() => {
    const cached = sessionStorage.getItem(`parley:${id}`);
    if (cached) {
      const data = JSON.parse(cached);
      sessionStorage.removeItem(`parley:${id}`);
      setState({
        conversationId: data.conversationId,
        scenario: data.scenario,
        language: data.language,
        level: data.level,
        goal: data.goal,
        npcName: data.npcName,
        mood: data.npcOpeningMood || "neutral",
        sceneImageUrl: data.sceneImageUrl,
        history: [{ role: "npc", text: data.npcOpeningMessage }],
        hints: data.hints || [],
        scenarioKey: data.scenarioKey,
        languageCode: data.languageCode,
      });
    } else {
      fetch(`/api/conversation/${id}`)
        .then((r) => {
          if (!r.ok) throw new Error("Conversation not found");
          return r.json();
        })
        .then((data) => setState(data))
        .catch((err) => setError(err.message));
    }
  }, [id]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.history, streamingText]);

  // Initialize TTS player
  useEffect(() => {
    ttsPlayerRef.current = new TTSPlayer();
    return () => {
      ttsPlayerRef.current?.dispose();
      ttsPlayerRef.current = null;
    };
  }, []);

  const autoPlayTts = useCallback((text: string, messageIndex: number, langCode?: string) => {
    ttsPlayerRef.current?.play(text, `msg-${messageIndex}`, langCode).then(() => {
      setTtsPlaying(null);
    }).catch(() => {
      setTtsPlaying(null);
    });
    setTtsPlaying(messageIndex);
  }, []);

  // Auto-play opening message on hydration
  const hasAutoPlayed = useRef(false);
  useEffect(() => {
    if (state && state.history.length > 0 && !hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      const firstNpc = state.history[0];
      if (firstNpc?.role === "npc") {
        autoPlayTts(firstNpc.text, 0, state.languageCode);
      }
    }
  }, [state, autoPlayTts]);

  // Auto-send transcribed speech
  useEffect(() => {
    if (pendingTranscription) {
      setPendingTranscription(null);
      sendMessage(pendingTranscription);
    }
  }, [pendingTranscription]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReplay(messageIndex: number, text: string) {
    autoPlayTts(text, messageIndex, state?.languageCode);
  }

  async function handleMicToggle() {
    if (recording) {
      // Stop recording
      setRecording(false);
      setTranscribing(true);
      try {
        const audioBase64 = await recorderRef.current!.stop();
        const res = await fetch("/api/stt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: audioBase64, languageCode: state?.languageCode }),
        });
        if (!res.ok) throw new Error("Transcription failed");
        const data = await res.json();
        if (data.text) {
          setPendingTranscription(data.text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    } else {
      // Start recording
      try {
        if (!recorderRef.current) {
          recorderRef.current = new AudioRecorder();
        }
        await recorderRef.current.start();
        setRecording(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Microphone access denied");
      }
    }
  }

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || sending || !state) return;
    setInput("");
    setSending(true);
    setStreamingText("");
    setError(null);

    setState((s) =>
      s ? { ...s, history: [...s.history, { role: "user", text: msg }], hints: [] } : s,
    );

    try {
      const res = await fetch(`/api/conversation/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      await consumeSSE(res, {
        onToken(text) {
          setStreamingText((prev) => prev + text);
        },
        onComplete(data: Record<string, unknown>) {
          setStreamingText("");
          const npcText = data.npcMessage as string;
          setState((s) => {
            if (!s) return s;
            const newHistory = [
              ...s.history,
              { role: "npc" as const, text: npcText },
            ];
            // Auto-play TTS for new NPC message
            autoPlayTts(npcText, newHistory.length - 1, s.languageCode);
            return {
              ...s,
              history: newHistory,
              mood: data.mood as string,
              hints: (data.hints as string[]) || [],
              sceneImageUrl: (data.sceneImageUrl as string) || s.sceneImageUrl,
            };
          });
          if (data.debrief) {
            setDebriefState({
              debrief: data.debrief as Debrief,
              sceneImageUrl: data.sceneImageUrl as string,
              npcName: state.npcName,
              goalStatus: data.goalStatus as string,
            });
          }
        },
        onError(err) {
          setError(err);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleQuit() {
    if (quitting || !state) return;
    setQuitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/conversation/${id}/quit`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to quit");
      const data = await res.json();
      setDebriefState({
        debrief: data.debrief,
        sceneImageUrl: data.sceneImageUrl,
        npcName: data.npcName,
        goalStatus: data.goalStatus,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to quit");
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

  // Debrief view
  if (debriefState) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 p-4 py-12">
        <img
          src={debriefState.sceneImageUrl}
          alt="Scene"
          className="w-full rounded-xl"
        />
        <div className="rounded-xl bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                debriefState.goalStatus === "achieved"
                  ? "bg-green-900 text-green-300"
                  : debriefState.goalStatus === "failed"
                    ? "bg-red-900 text-red-300"
                    : "bg-yellow-900 text-yellow-300"
              }`}
            >
              {debriefState.goalStatus === "achieved"
                ? tDebrief("goalAchieved")
                : debriefState.goalStatus === "failed"
                  ? tDebrief("goalFailed")
                  : tDebrief("quitEarly")}
            </span>
            <span className="text-slate-400">
              {tDebrief("withNpc", { npcName: debriefState.npcName })}
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            {debriefState.debrief.narrative}
          </p>
          {debriefState.debrief.keyPhrases.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-400 uppercase tracking-wide">
                {tDebrief("keyPhrases")}
              </h3>
              <ul className="space-y-2">
                {debriefState.debrief.keyPhrases.map((kp, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="font-medium text-blue-400">
                      {kp.phrase}
                    </span>
                    <span className="text-slate-500">{kp.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Link
          href="/"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-500"
        >
          {tDebrief("newScenario")}
        </Link>
      </main>
    );
  }

  // Conversation view
  return (
    <main className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="relative flex-shrink-0">
        <img
          src={state.sceneImageUrl}
          alt="Scene"
          className="h-48 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950" />
        <div className="absolute bottom-3 left-4 flex gap-2">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
            {state.languageCode ? tLangs(state.languageCode) : tLangs(LANGUAGE_CODE_MAP[state.language] ?? "en")}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs ${
            state.level === "impossible"
              ? "bg-red-900/80 text-red-300"
              : "bg-slate-900/80 text-slate-300"
          }`}>
            {tLevels(state.level as "beginner" | "intermediate" | "advanced" | "impossible")}
          </span>
          <span className="rounded-full bg-blue-900/80 px-3 py-1 text-xs text-blue-300">
            {state.mood}
          </span>
        </div>
      </div>

      {/* Goal banner */}
      <div className={`flex-shrink-0 border-b px-4 py-2.5 ${
        state.level === "impossible"
          ? "border-red-900/50 bg-red-950/30"
          : "border-slate-800 bg-slate-900/50"
      }`}>
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-medium ${
            state.level === "impossible" ? "text-red-400" : "text-slate-400"
          }`}>
            {t("goalLabel")}
          </span>
          <span className={
            state.level === "impossible" ? "text-red-300" : "text-slate-300"
          }>
            {state.scenarioKey
              ? tScenarios(`${state.scenarioKey}_goal_${state.level}`)
              : state.goal}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {state.history.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-200"
              }`}
            >
              {msg.role === "npc" && (
                <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  {state.npcName}
                  <button
                    type="button"
                    onClick={() => handleReplay(i, msg.text)}
                    title={t("replaySpeaker")}
                    className="inline-flex items-center text-slate-500 hover:text-blue-400 transition-colors"
                  >
                    {ttsPlaying === i ? (
                      <svg className="h-3.5 w-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                    )}
                  </button>
                </span>
              )}
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-slate-800 px-4 py-2.5 text-slate-200">
              <span className="mb-1 block text-xs font-medium text-slate-400">
                {state.npcName}
              </span>
              <p className="whitespace-pre-wrap">
                {streamingText}
                <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-blue-400" />
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEnd} />
      </div>

      {/* Hints */}
      {state.hints.length > 0 && !sending && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          {state.hints.map((hint, i) => (
            <button
              key={i}
              onClick={() => setInput(hint)}
              className="flex-shrink-0 rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="px-4 text-sm text-red-400">{error}</p>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recording ? t("recording") : transcribing ? t("transcribing") : t("messagePlaceholder", { language: state.languageCode ? tLangs(state.languageCode) : tLangs(LANGUAGE_CODE_MAP[state.language] ?? "en") })}
            disabled={sending || recording}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={sending || transcribing}
            title={recording ? t("stopRecording") : t("startRecording")}
            className={`rounded-lg px-3 py-2.5 transition-colors ${
              recording
                ? "bg-red-600 text-white animate-pulse"
                : "border border-slate-700 text-slate-400 hover:bg-slate-800"
            } disabled:opacity-50`}
          >
            {transcribing ? (
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            )}
          </button>
          <button
            type="submit"
            disabled={sending || !input.trim() || recording}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {t("send")}
          </button>
          <button
            type="button"
            onClick={handleQuit}
            disabled={sending || quitting || recording}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-50"
          >
            {quitting ? "..." : t("quit")}
          </button>
        </form>
      </div>
    </main>
  );
}
