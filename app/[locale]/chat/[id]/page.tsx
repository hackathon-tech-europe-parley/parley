"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { consumeSSE } from "@/lib/sse-client";
import { Link } from "@/i18n/navigation";
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
  const messagesEnd = useRef<HTMLDivElement>(null);

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
          setState((s) => {
            if (!s) return s;
            return {
              ...s,
              history: [
                ...s.history,
                { role: "npc" as const, text: data.npcMessage as string },
              ],
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
                <span className="mb-1 block text-xs font-medium text-slate-400">
                  {state.npcName}
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
            placeholder={t("messagePlaceholder", { language: state.languageCode ? tLangs(state.languageCode) : tLangs(LANGUAGE_CODE_MAP[state.language] ?? "en") })}
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {t("send")}
          </button>
          <button
            type="button"
            onClick={handleQuit}
            disabled={sending || quitting}
            className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-50"
          >
            {quitting ? "..." : t("quit")}
          </button>
        </form>
      </div>
    </main>
  );
}
