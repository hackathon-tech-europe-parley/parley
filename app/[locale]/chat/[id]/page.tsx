"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { consumeSSE } from "@/lib/sse-client";
import { Link, useRouter } from "@/i18n/navigation";
import { AudioRecorder } from "@/lib/audio-recorder";
import { TTSPlayer } from "@/lib/tts-player";
import {
  conversationCacheSchema,
  conversationSnapshotSchema,
  messageStreamCompletePayloadSchema,
  quitConversationResponseSchema,
  sttResponseSchema,
  type ConversationLevel,
  type ConversationMessage,
  type Debrief,
  type GoalProgress,
  type LanguageCode,
  type NpcGender,
  type MessageStreamCompletePayload,
} from "@/lib/types";

interface ConversationState {
  conversationId: string;
  scenario: string;
  language: string;
  level: ConversationLevel;
  goal: string;
  npcName: string;
  npcGender?: NpcGender;
  mood: string;
  goalProgress: GoalProgress;
  sceneImageUrl: string;
  npcFaceImageUrl: string;
  history: ConversationMessage[];
  hints: string[];
  scenarioKey?: string;
  languageCode?: LanguageCode;
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

// Glow shadow colors for active progress segments
const GOAL_PROGRESS_GLOW: Record<GoalProgress, string> = {
  1: "shadow-slate-600/40",
  2: "shadow-blue-500/40",
  3: "shadow-amber-500/40",
  4: "shadow-orange-400/40",
  5: "shadow-green-500/50",
};

const GOAL_PROGRESS_GLOW_IMPOSSIBLE: Record<GoalProgress, string> = {
  1: "shadow-red-900/40",
  2: "shadow-rose-700/40",
  3: "shadow-red-600/40",
  4: "shadow-red-500/40",
  5: "shadow-red-400/50",
};

// Mood visual theming — maps mood keywords to color schemes
function getMoodTheme(mood: string): {
  bg: string;
  border: string;
  text: string;
  dot: string;
  glow: string;
} {
  const m = mood.toLowerCase();
  if (["warm", "friendly", "happy", "cheerful", "welcoming", "kind", "pleased"].some(k => m.includes(k))) {
    return { bg: "bg-emerald-950/50", border: "border-emerald-700/50", text: "text-emerald-300", dot: "bg-emerald-400", glow: "shadow-emerald-500/20" };
  }
  if (["cold", "distant", "indifferent", "aloof", "reserved", "cool"].some(k => m.includes(k))) {
    return { bg: "bg-cyan-950/40", border: "border-cyan-800/40", text: "text-cyan-300", dot: "bg-cyan-400", glow: "shadow-cyan-500/20" };
  }
  if (["angry", "hostile", "furious", "enraged", "aggressive"].some(k => m.includes(k))) {
    return { bg: "bg-red-950/50", border: "border-red-800/50", text: "text-red-300", dot: "bg-red-400", glow: "shadow-red-500/30" };
  }
  if (["annoyed", "frustrated", "irritated", "impatient", "exasperated"].some(k => m.includes(k))) {
    return { bg: "bg-amber-950/40", border: "border-amber-800/40", text: "text-amber-300", dot: "bg-amber-400", glow: "shadow-amber-500/20" };
  }
  if (["suspicious", "wary", "distrustful", "guarded", "skeptical"].some(k => m.includes(k))) {
    return { bg: "bg-violet-950/40", border: "border-violet-800/40", text: "text-violet-300", dot: "bg-violet-400", glow: "shadow-violet-500/20" };
  }
  if (["sad", "melancholic", "gloomy", "somber", "dejected"].some(k => m.includes(k))) {
    return { bg: "bg-indigo-950/40", border: "border-indigo-800/40", text: "text-indigo-300", dot: "bg-indigo-400", glow: "shadow-indigo-500/20" };
  }
  // Neutral / professional / default
  return { bg: "bg-blue-950/30", border: "border-blue-800/30", text: "text-blue-300", dot: "bg-blue-400", glow: "shadow-blue-500/15" };
}

interface DebriefState {
  debrief: Debrief;
  sceneImageUrl: string;
  npcName: string;
  goalStatus: string;
}

function fromCachedConversation(
  cached: ReturnType<typeof conversationCacheSchema.parse>,
): ConversationState {
  return {
    conversationId: cached.conversationId,
    scenario: cached.scenario,
    language: cached.language,
    level: cached.level,
    goal: cached.goal,
    npcName: cached.npcName,
    npcGender: cached.npcGender,
    mood: cached.npcOpeningMood,
    goalProgress: cached.npcOpeningGoalProgress,
    sceneImageUrl: cached.sceneImageUrl,
    npcFaceImageUrl: cached.npcFaceImageUrl,
    history: [{ role: "npc", text: cached.npcOpeningMessage }],
    hints: cached.hints,
    scenarioKey: cached.scenarioKey,
    languageCode: cached.languageCode,
  };
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("Chat");
  const tDebrief = useTranslations("Debrief");
  const tLevels = useTranslations("Levels");
  const tLangs = useTranslations("Languages");
  const tScenarios = useTranslations("Scenarios");
  const [state, setState] = useState<ConversationState | null>(null);
  const [debriefState, setDebriefState] = useState<DebriefState | null>(null);
  const [input, setInput] = useState("");
  const streamingTextRef = useRef("");
  const [sending, setSending] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingTranscription, setPendingTranscription] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState<number | null>(null);
  const [npcMuted, setNpcMuted] = useState(false);
  const [endStatus, setEndStatus] = useState<DebriefState | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const ttsPlayerRef = useRef<TTSPlayer | null>(null);

  // Hydrate from sessionStorage or API
  useEffect(() => {
    const cached = sessionStorage.getItem(`parley:${id}`);
    if (cached) {
      sessionStorage.removeItem(`parley:${id}`);
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

    fetch(`/api/conversation/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Conversation not found");
        return r.json();
      })
      .then((data: unknown) => {
        const parsed = conversationSnapshotSchema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Malformed conversation payload");
        }
        setState(parsed.data);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.history, sending, endStatus]);

  // Initialize TTS player
  useEffect(() => {
    ttsPlayerRef.current = new TTSPlayer();
    return () => {
      ttsPlayerRef.current?.dispose();
      ttsPlayerRef.current = null;
    };
  }, []);

  const autoPlayTts = useCallback((text: string, messageIndex: number, langCode?: string, gender?: NpcGender) => {
    if (!ttsPlayerRef.current || ttsPlayerRef.current.muted) return;
    setTtsPlaying(messageIndex);
    ttsPlayerRef.current.play(text, `msg-${messageIndex}`, langCode, gender).then(() => {
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
        autoPlayTts(firstNpc.text, 0, state.languageCode, state.npcGender);
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
          autoPlayTts(message.text, i, state.languageCode, state.npcGender);
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
    autoPlayTts(text, messageIndex, state?.languageCode, state?.npcGender);
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
        const data = sttResponseSchema.safeParse(await res.json());
        if (!data.success) {
          throw new Error("Malformed transcription payload");
        }
        if (data.data.text) {
          setPendingTranscription(data.data.text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    } else {
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
    streamingTextRef.current = "";
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

      let completeData: MessageStreamCompletePayload | null = null;

      await consumeSSE<MessageStreamCompletePayload>(
        res,
        {
          onToken(text) {
            streamingTextRef.current += text;
          },
          onComplete(data) {
            completeData = data;
          },
          onError(err) {
            setError(err);
          },
        },
        messageStreamCompletePayloadSchema,
      );

      // Preload all assets before revealing the message
      if (completeData) {
        const data = completeData as MessageStreamCompletePayload;
        const npcMsgIndex = state.history.length + 1;
        const cacheKey = `msg-${npcMsgIndex}`;

        const preloads: Promise<void>[] = [];

        if (ttsPlayerRef.current && !ttsPlayerRef.current.muted) {
          preloads.push(
            ttsPlayerRef.current.prefetch(data.npcMessage, cacheKey, state.languageCode, state.npcGender),
          );
        }
        if (data.sceneImageUrl && data.sceneImageUrl !== state.sceneImageUrl) {
          preloads.push(preloadImage(data.sceneImageUrl));
        }
        if (data.npcFaceImageUrl && data.npcFaceImageUrl !== state.npcFaceImageUrl) {
          preloads.push(preloadImage(data.npcFaceImageUrl));
        }

        await Promise.all(preloads);

        // Commit everything in one render
        streamingTextRef.current = "";
        setState((s) => {
          if (!s) return s;
          return {
            ...s,
            history: [...s.history, { role: "npc" as const, text: data.npcMessage }],
            mood: data.mood,
            goalProgress: data.goalProgress,
            hints: data.hints,
            sceneImageUrl: data.sceneImageUrl,
            npcFaceImageUrl: data.npcFaceImageUrl || s.npcFaceImageUrl,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to quit");
      setQuitting(false);
    }
  }

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
      router.push("/");
    } else {
      setDebriefState(endStatus);
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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── MOOD INDICATOR ── hero element #1 */}
          {(() => {
            const mt = getMoodTheme(state.mood);
            return (
              <div
                className={`hud-panel relative rounded-xl border p-4 shadow-lg transition-all duration-700 ${mt.bg} ${mt.border} ${mt.glow}`}
              >
                <div className="flex items-center gap-3">
                  {state.npcFaceImageUrl && (
                    <img
                      src={state.npcFaceImageUrl}
                      alt={state.npcName}
                      className="h-11 w-11 rounded-full object-cover border-2 border-slate-700/60 flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">
                      {state.npcName}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`mood-dot inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${mt.dot}`} />
                      <span className={`text-lg font-bold capitalize tracking-tight transition-colors duration-700 ${mt.text}`}>
                        {state.mood}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── OBJECTIVE CARD ── hero element #2 */}
          <div
            className={`hud-panel relative rounded-xl border p-5 shadow-lg ${
              state.level === "impossible"
                ? "bg-red-950/40 border-red-800/50"
                : "bg-slate-900/60 border-slate-700/50"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-[11px] font-bold uppercase tracking-[0.15em] ${
                state.level === "impossible" ? "text-red-400/80" : "text-slate-400"
              }`}>
                Objective
              </h3>
              <span className={`text-xs font-mono font-bold tabular-nums ${
                state.level === "impossible" ? "text-red-400/70" : "text-slate-500"
              }`}>
                {state.goalProgress}/5
              </span>
            </div>

            {/* Goal text */}
            <p className={`text-[15px] font-medium leading-snug mb-4 ${
              state.level === "impossible" ? "text-red-100" : "text-slate-100"
            }`}>
              {state.scenarioKey
                ? tScenarios(`${state.scenarioKey}_goal_${state.level}`)
                : state.goal}
            </p>

            {/* Chunky segmented progress bar */}
            <div
              role="img"
              aria-label={`Goal progress ${state.goalProgress} of 5`}
              className="flex gap-1.5"
            >
              {GOAL_PROGRESS_STEPS.map((step) => {
                const isActive = step <= state.goalProgress;
                const glowPalette = state.level === "impossible" ? GOAL_PROGRESS_GLOW_IMPOSSIBLE : GOAL_PROGRESS_GLOW;
                return (
                  <span
                    key={step}
                    className={`h-3 flex-1 rounded-md transition-all duration-500 ${
                      isActive
                        ? `${progressPalette[state.goalProgress]} shadow-md ${glowPalette[state.goalProgress]}`
                        : progressTrackColor
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="border-t border-slate-800/60" />

          {/* ── SECONDARY INFO ── quieter section */}

          {/* Scenario */}
          <div>
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Scenario
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {state.scenario}
            </p>
          </div>

          {/* Language & Level — inline badges */}
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/15 border border-blue-600/25 px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-blue-400/60 uppercase tracking-wider">Lang</span>
              <span className="text-sm text-blue-300 font-medium">
                {state.languageCode ? tLangs(state.languageCode) : tLangs(LANGUAGE_CODE_MAP[state.language] ?? "en")}
              </span>
            </div>
            <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
              state.level === "impossible"
                ? "bg-red-600/15 border-red-600/25"
                : "bg-slate-800/40 border-slate-700/40"
            }`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                state.level === "impossible" ? "text-red-400/60" : "text-slate-500"
              }`}>Level</span>
              <span className={`text-sm font-medium ${
                state.level === "impossible" ? "text-red-300" : "text-slate-300"
              }`}>
                {tLevels(state.level as "beginner" | "intermediate" | "advanced" | "impossible")}
              </span>
            </div>
          </div>

          {/* Conversation Stats */}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Messages</span>
            <span className="text-slate-300 font-medium tabular-nums">{state.history.length}</span>
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

          {sending && (
            <div className="flex items-start gap-3 justify-start">
              {state.npcFaceImageUrl && (
                <img
                  src={state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-20 w-20 rounded-full object-cover border-2 border-slate-700/50 flex-shrink-0"
                />
              )}
              <div className="rounded-2xl bg-slate-800/90 backdrop-blur-sm px-5 py-4 border border-slate-700/50 shadow-lg">
                <div className="mb-2">
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                    {state.npcName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {endStatus && (
            <div className="flex justify-center py-4">
              <div className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                endStatus.goalStatus === "achieved"
                  ? "bg-green-900/30 text-green-400 border border-green-800/50"
                  : endStatus.goalStatus === "failed"
                    ? "bg-red-900/30 text-red-400 border border-red-800/50"
                    : "bg-amber-900/30 text-amber-400 border border-amber-800/50"
              }`}>
                {endStatus.goalStatus === "achieved"
                  ? tDebrief("goalAchieved")
                  : endStatus.goalStatus === "failed"
                    ? tDebrief("goalFailed")
                    : tDebrief("quitEarly")}
              </div>
            </div>
          )}

          <div ref={messagesEnd} />
        </div>

        {/* Hints */}
        {state.hints.length > 0 && !sending && !endStatus && (
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

        {/* Input / End status */}
        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 p-4">
          {endStatus ? (
            <button
              type="button"
              onClick={handleEndStatusClick}
              className={`w-full rounded-xl p-5 text-left transition-all ${
                endStatus.goalStatus === "achieved"
                  ? "bg-gradient-to-r from-green-900/50 to-green-800/30 border border-green-700/50 hover:from-green-900/70 hover:to-green-800/50"
                  : endStatus.goalStatus === "failed"
                    ? "bg-gradient-to-r from-red-900/50 to-red-800/30 border border-red-700/50 hover:from-red-900/70 hover:to-red-800/50"
                    : "bg-gradient-to-r from-amber-900/50 to-amber-800/30 border border-amber-700/50 hover:from-amber-900/70 hover:to-amber-800/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {endStatus.goalStatus === "achieved" ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/30">
                      <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  ) : endStatus.goalStatus === "failed" ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/30">
                      <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600/30">
                      <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  )}
                  <div>
                    <p className={`font-semibold ${
                      endStatus.goalStatus === "achieved" ? "text-green-300" : endStatus.goalStatus === "failed" ? "text-red-300" : "text-amber-300"
                    }`}>
                      {endStatus.goalStatus === "achieved"
                        ? tDebrief("goalAchieved")
                        : endStatus.goalStatus === "failed"
                          ? tDebrief("goalFailed")
                          : tDebrief("quitEarly")}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {endStatus.goalStatus === "achieved"
                        ? t("clickNewScenario")
                        : t("clickForDebrief")}
                    </p>
                  </div>
                </div>
                <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ) : (
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
                onClick={() => {
                  const next = !npcMuted;
                  setNpcMuted(next);
                  if (ttsPlayerRef.current) {
                    ttsPlayerRef.current.muted = next;
                  }
                  if (next) setTtsPlaying(null);
                }}
                title={npcMuted ? t("unmute") : t("mute")}
                className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-400 hover:bg-slate-700/50 hover:border-slate-600 transition-all"
              >
                {npcMuted ? (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                )}
              </button>
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
          )}
        </div>
      </div>

      {/* Debrief modal */}
      {debriefState && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setDebriefState(null)}
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Scene image */}
            <img
              src={debriefState.sceneImageUrl}
              alt="Scene"
              className="w-full rounded-t-2xl h-48 object-cover"
            />

            <div className="p-6 space-y-4">
              {/* Status badge + NPC name */}
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
                <span className="text-slate-400 text-sm">
                  {tDebrief("withNpc", { npcName: debriefState.npcName })}
                </span>
              </div>

              {/* Narrative */}
              <p className="text-slate-300 leading-relaxed text-sm">
                {debriefState.debrief.narrative}
              </p>

              {/* Key phrases */}
              {debriefState.debrief.keyPhrases.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {tDebrief("keyPhrases")}
                  </h3>
                  <ul className="space-y-2">
                    {debriefState.debrief.keyPhrases.map((kp, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="font-medium text-blue-400">{kp.phrase}</span>
                        <span className="text-slate-500">{kp.translation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CTA */}
              <Link
                href="/"
                className="block w-full rounded-xl bg-blue-600 px-6 py-3 text-center font-medium text-white hover:bg-blue-500 transition-colors"
              >
                {tDebrief("newScenario")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
