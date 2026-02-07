"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { consumeSSE } from "@/lib/sse-client";
import { Link } from "@/i18n/navigation";
import { AudioRecorder } from "@/lib/audio-recorder";
import { TTSPlayer } from "@/lib/tts-player";
import type { ConversationMessage, Debrief, GoalProgress } from "@/lib/types";

interface ConversationState {
  conversationId: string;
  scenario: string;
  language: string;
  level: string;
  goal: string;
  npcName: string;
  mood: string;
  goalProgress: GoalProgress;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
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

const GOAL_PROGRESS_STEPS: GoalProgress[] = [1, 2, 3, 4, 5];

const GOAL_PROGRESS_COLORS: Record<GoalProgress, string> = {
  1: "bg-slate-600",
  2: "bg-blue-500",
  3: "bg-amber-500",
  4: "bg-orange-400",
  5: "bg-green-500",
};

const GOAL_PROGRESS_COLORS_IMPOSSIBLE: Record<GoalProgress, string> = {
  1: "bg-red-900",
  2: "bg-rose-700",
  3: "bg-red-600",
  4: "bg-red-500",
  5: "bg-red-400",
};

function sanitizeGoalProgress(
  value: unknown,
  fallback: GoalProgress = 1,
): GoalProgress {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  const clamped = Math.min(5, Math.max(1, rounded));
  return clamped as GoalProgress;
}

function sanitizeMood(value: unknown, fallback = "neutral"): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

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
        mood: sanitizeMood(data.npcOpeningMood, "neutral"),
        goalProgress: sanitizeGoalProgress(
          data.npcOpeningGoalProgress,
          sanitizeGoalProgress(data.goalProgress, 1),
        ),
        sceneImageUrl: data.sceneImageUrl,
        npcFaceImageUrl: data.npcFaceImageUrl || "",
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
        .then((data) =>
          setState({
            ...data,
            mood: sanitizeMood(data.mood, "neutral"),
            goalProgress: sanitizeGoalProgress(data.goalProgress, 1),
          }),
        )
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
    if (!ttsPlayerRef.current) return;
    setTtsPlaying(messageIndex);
    ttsPlayerRef.current.play(text, `msg-${messageIndex}`, langCode).then(() => {
      setTtsPlaying(null);
    }).catch((err) => {
      console.error("TTS autoplay failed:", err);
      setTtsPlaying(null);
    });
  }, []);

  // Auto-play opening message on hydration
  const hasAutoPlayed = useRef(false);
  const lastProcessedIndex = useRef(-1);

  // Initialize lastProcessedIndex when state first loads
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
        autoPlayTts(firstNpc.text, 0, state.languageCode);
        lastProcessedIndex.current = 0;
      }
    }
  }, [state, autoPlayTts]);

  // Auto-play new NPC messages
  useEffect(() => {
    if (!state || !state.history.length) return;
    
    const currentLastIndex = state.history.length - 1;
    // Check if there are new messages we haven't processed
    if (currentLastIndex > lastProcessedIndex.current) {
      // Process all new messages since the last one we processed
      for (let i = lastProcessedIndex.current + 1; i <= currentLastIndex; i++) {
        const message = state.history[i];
        if (message?.role === "npc") {
          autoPlayTts(message.text, i, state.languageCode);
        }
      }
      // Update after processing all new messages
      lastProcessedIndex.current = currentLastIndex;
    }
  }, [state?.history.length, state, autoPlayTts]);

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
          const npcText =
            typeof data.npcMessage === "string" && data.npcMessage.trim().length > 0
              ? data.npcMessage
              : "...";
          const nextHints = Array.isArray(data.hints)
            ? data.hints.filter((hint): hint is string => typeof hint === "string")
            : [];
          setState((s) => {
            if (!s) return s;
            const newHistory = [
              ...s.history,
              { role: "npc" as const, text: npcText },
            ];
            return {
              ...s,
              history: newHistory,
              mood: sanitizeMood(data.mood, s.mood),
              goalProgress: sanitizeGoalProgress(data.goalProgress, s.goalProgress),
              hints: nextHints,
              sceneImageUrl: (data.sceneImageUrl as string) || s.sceneImageUrl,
              npcFaceImageUrl: (data.npcFaceImageUrl as string) || s.npcFaceImageUrl,
            };
          });
          if (data.debrief) {
            setDebriefState({
              debrief: data.debrief as Debrief,
              sceneImageUrl: data.sceneImageUrl as string,
              npcName: state.npcName,
              goalStatus:
                typeof data.goalStatus === "string"
                  ? data.goalStatus
                  : "ongoing",
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
  const progressPalette =
    state.level === "impossible"
      ? GOAL_PROGRESS_COLORS_IMPOSSIBLE
      : GOAL_PROGRESS_COLORS;
  const progressTrackColor =
    state.level === "impossible" ? "bg-red-950/70" : "bg-slate-800/80";

  return (
    <main className="flex flex-1 min-h-0 h-screen">
      {/* Left side - Meta Information (30%) */}
      <div className="flex flex-col flex-[0.3] min-w-0 bg-slate-950">
        {/* Scene Image */}
        <div className="relative flex-shrink-0 h-64 overflow-hidden">
          <img
            src={state.sceneImageUrl}
            alt="Scene"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />
        </div>

        {/* Meta Information */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Scenario */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Scenario
            </h3>
            <p className="text-slate-200 text-sm leading-relaxed">
              {state.scenario}
            </p>
          </div>

          {/* Language & Level */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Target Language
              </h3>
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-600/20 border border-blue-600/30 px-3 py-2">
                <span className="text-blue-300 font-medium">
                  {state.languageCode ? tLangs(state.languageCode) : tLangs(LANGUAGE_CODE_MAP[state.language] ?? "en")}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Difficulty Level
              </h3>
              <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 border ${
                state.level === "impossible"
                  ? "bg-red-600/20 border-red-600/30"
                  : "bg-slate-800/50 border-slate-700/50"
              }`}>
                <span className={`font-medium ${
                  state.level === "impossible" ? "text-red-300" : "text-slate-300"
                }`}>
                  {tLevels(state.level as "beginner" | "intermediate" | "advanced" | "impossible")}
                </span>
              </div>
            </div>
          </div>

          {/* Objective */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Objective
            </h3>
            <div className={`rounded-lg p-4 border ${
              state.level === "impossible"
                ? "bg-red-950/30 border-red-900/50"
                : "bg-slate-800/30 border-slate-700/50"
            }`}>
              <p className={`text-sm leading-relaxed ${
                state.level === "impossible" ? "text-red-200" : "text-slate-200"
              }`}>
                {state.scenarioKey
                  ? tScenarios(`${state.scenarioKey}_goal_${state.level}`)
                  : state.goal}
              </p>
              <div
                role="img"
                aria-label={`Goal progress ${state.goalProgress} of 5`}
                className="mt-3 flex gap-1"
              >
                {GOAL_PROGRESS_STEPS.map((step) => (
                  <span
                    key={step}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      step <= state.goalProgress
                        ? progressPalette[state.goalProgress]
                        : progressTrackColor
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* NPC Info */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Character
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-slate-400">Name</span>
                <p className="text-slate-200 font-medium">{state.npcName}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Current Mood</span>
                <div className="mt-1 inline-flex items-center gap-2 rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-1.5">
                  <span className="text-blue-300 font-medium capitalize">{state.mood}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conversation Stats */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Conversation
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Messages</span>
                <span className="text-slate-200 font-medium">{state.history.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Messages (70%) */}
      <div className="flex flex-col flex-[0.7] min-w-0 border-l border-slate-800">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-950 to-slate-900">
          {state.history.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "npc" && state.npcFaceImageUrl && (
                <img
                  src={state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-20 w-20 rounded-full object-cover border-2 border-slate-700/50 flex-shrink-0"
                />
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-lg ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                    : "bg-slate-800/90 backdrop-blur-sm text-slate-100 border border-slate-700/50"
                }`}
              >
                {msg.role === "npc" && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                      {state.npcName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReplay(i, msg.text)}
                      title={t("replaySpeaker")}
                      className="inline-flex items-center text-slate-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-700/50"
                    >
                      {ttsPlaying === i ? (
                        <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                      ) : (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                      )}
                    </button>
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{msg.text}</p>
              </div>
              {msg.role === "user" && (
                <div className="h-20 w-20 flex-shrink-0" />
              )}
            </div>
          ))}

          {streamingText && (
            <div className="flex items-start gap-3 justify-start">
              {state.npcFaceImageUrl && (
                <img
                  src={state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-20 w-20 rounded-full object-cover border-2 border-slate-700/50 flex-shrink-0"
                />
              )}
              <div className="max-w-[75%] rounded-2xl bg-slate-800/90 backdrop-blur-sm px-5 py-3 text-slate-100 border border-slate-700/50 shadow-lg">
                <div className="mb-2">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                    {state.npcName}
                  </span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-[15px]">
                  {streamingText}
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-blue-400" />
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>

        {/* Hints */}
        {state.hints.length > 0 && !sending && (
          <div className="flex-shrink-0 border-t border-slate-800/50 bg-slate-900/50 px-6 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {state.hints.map((hint, i) => (
                <button
                  key={i}
                  onClick={() => setInput(hint)}
                  className="flex-shrink-0 rounded-full border border-blue-600/30 bg-blue-600/10 px-4 py-2 text-sm text-blue-300 hover:bg-blue-600/20 hover:border-blue-600/50 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 px-6 py-2 bg-red-950/30 border-t border-red-900/50">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={recording ? t("recording") : transcribing ? t("transcribing") : t("messagePlaceholder", { language: state.languageCode ? tLangs(state.languageCode) : tLangs(LANGUAGE_CODE_MAP[state.language] ?? "en") })}
              disabled={sending || recording}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm px-5 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={sending || transcribing}
              title={recording ? t("stopRecording") : t("startRecording")}
              className={`rounded-xl px-4 py-3 transition-all ${
                recording
                  ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/30"
                  : "border border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:border-slate-600"
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
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30 transition-all"
            >
              {t("send")}
            </button>
            <button
              type="button"
              onClick={handleQuit}
              disabled={sending || quitting || recording}
              className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-400 hover:bg-slate-700/50 hover:border-slate-600 disabled:opacity-50 transition-all"
            >
              {quitting ? "..." : t("quit")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
