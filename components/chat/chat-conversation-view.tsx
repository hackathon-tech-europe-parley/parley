import type { FormEvent, RefObject } from "react";
import {
  GOAL_PROGRESS_COLORS,
  GOAL_PROGRESS_COLORS_IMPOSSIBLE,
  GOAL_PROGRESS_GLOW,
  GOAL_PROGRESS_GLOW_IMPOSSIBLE,
  GOAL_PROGRESS_STEPS,
  LANGUAGE_CODE_MAP,
  getMoodTheme,
} from "./chat-constants";
import type { ConversationState } from "./chat-types";

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface ChatConversationViewProps {
  state: ConversationState;
  input: string;
  streamingText: string;
  sending: boolean;
  quitting: boolean;
  recording: boolean;
  transcribing: boolean;
  ttsPlaying: number | null;
  error: string | null;
  t: TranslateFn;
  tLevels: TranslateFn;
  tLangs: TranslateFn;
  tScenarios: TranslateFn;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onReplay: (messageIndex: number, text: string) => void;
  onHintSelect: (hint: string) => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onMicToggle: () => void;
  onQuit: () => void;
}

function handleSubmit(event: FormEvent<HTMLFormElement>, onSubmit: () => void) {
  event.preventDefault();
  onSubmit();
}

export function ChatConversationView({
  state,
  input,
  streamingText,
  sending,
  quitting,
  recording,
  transcribing,
  ttsPlaying,
  error,
  t,
  tLevels,
  tLangs,
  tScenarios,
  messagesEndRef,
  onReplay,
  onHintSelect,
  onInputChange,
  onSubmit,
  onMicToggle,
  onQuit,
}: ChatConversationViewProps) {
  const progressPalette =
    state.level === "impossible"
      ? GOAL_PROGRESS_COLORS_IMPOSSIBLE
      : GOAL_PROGRESS_COLORS;
  const progressTrackColor =
    state.level === "impossible" ? "bg-red-950/70" : "bg-slate-800/80";
  const glowPalette =
    state.level === "impossible"
      ? GOAL_PROGRESS_GLOW_IMPOSSIBLE
      : GOAL_PROGRESS_GLOW;
  const activeLanguageCode = state.languageCode ?? LANGUAGE_CODE_MAP[state.language] ?? "en";

  return (
    <main className="flex h-screen min-h-0 flex-1">
      {/* Left side - Meta Information (30%) */}
      <div className="flex min-w-0 flex-[0.3] flex-col bg-slate-950">
        {/* Scene Image */}
        <div className="relative h-64 flex-shrink-0 overflow-hidden">
          <img src={state.sceneImageUrl} alt="Scene" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />
        </div>

        {/* Meta Information */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Mood Indicator */}
          {(() => {
            const moodTheme = getMoodTheme(state.mood);
            return (
              <div
                className={`hud-panel relative rounded-xl border p-4 shadow-lg transition-all duration-700 ${moodTheme.bg} ${moodTheme.border} ${moodTheme.glow}`}
              >
                <div className="flex items-center gap-3">
                  {state.npcFaceImageUrl && (
                    <img
                      src={state.npcFaceImageUrl}
                      alt={state.npcName}
                      className="h-11 w-11 flex-shrink-0 rounded-full border-2 border-slate-700/60 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-semibold uppercase leading-none tracking-wider text-slate-400">
                      {state.npcName}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`mood-dot inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${moodTheme.dot}`}
                      />
                      <span
                        className={`text-lg font-bold capitalize tracking-tight transition-colors duration-700 ${moodTheme.text}`}
                      >
                        {state.mood}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Objective Card */}
          <div
            className={`hud-panel relative rounded-xl border p-5 shadow-lg ${
              state.level === "impossible"
                ? "border-red-800/50 bg-red-950/40"
                : "border-slate-700/50 bg-slate-900/60"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3
                className={`text-[11px] font-bold uppercase tracking-[0.15em] ${
                  state.level === "impossible" ? "text-red-400/80" : "text-slate-400"
                }`}
              >
                Objective
              </h3>
              <span
                className={`text-xs font-mono font-bold tabular-nums ${
                  state.level === "impossible" ? "text-red-400/70" : "text-slate-500"
                }`}
              >
                {state.goalProgress}/5
              </span>
            </div>

            <p
              className={`mb-4 text-[15px] font-medium leading-snug ${
                state.level === "impossible" ? "text-red-100" : "text-slate-100"
              }`}
            >
              {state.scenarioKey
                ? tScenarios(`${state.scenarioKey}_goal_${state.level}`)
                : state.goal}
            </p>

            <div role="img" aria-label={`Goal progress ${state.goalProgress} of 5`} className="flex gap-1.5">
              {GOAL_PROGRESS_STEPS.map((step) => {
                const isActive = step <= state.goalProgress;
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

          <div className="border-t border-slate-800/60" />

          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Scenario
            </h3>
            <p className="text-sm leading-relaxed text-slate-300">{state.scenario}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600/25 bg-blue-600/15 px-2.5 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400/60">
                Lang
              </span>
              <span className="text-sm font-medium text-blue-300">
                {tLangs(activeLanguageCode)}
              </span>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                state.level === "impossible"
                  ? "border-red-600/25 bg-red-600/15"
                  : "border-slate-700/40 bg-slate-800/40"
              }`}
            >
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  state.level === "impossible" ? "text-red-400/60" : "text-slate-500"
                }`}
              >
                Level
              </span>
              <span
                className={`text-sm font-medium ${
                  state.level === "impossible" ? "text-red-300" : "text-slate-300"
                }`}
              >
                {tLevels(
                  state.level as "beginner" | "intermediate" | "advanced" | "impossible",
                )}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Messages</span>
            <span className="font-medium tabular-nums text-slate-300">
              {state.history.length}
            </span>
          </div>
        </div>
      </div>

      {/* Right side - Messages (70%) */}
      <div className="flex min-w-0 flex-[0.7] flex-col border-l border-slate-800">
        <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 p-6">
          {state.history.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "npc" && state.npcFaceImageUrl && (
                <img
                  src={state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-20 w-20 flex-shrink-0 rounded-full border-2 border-slate-700/50 object-cover"
                />
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-lg ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                    : "border border-slate-700/50 bg-slate-800/90 text-slate-100 backdrop-blur-sm"
                }`}
              >
                {msg.role === "npc" && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                      {state.npcName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onReplay(i, msg.text)}
                      title={t("replaySpeaker")}
                      className="inline-flex items-center rounded p-1 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-blue-400"
                    >
                      {ttsPlaying === i ? (
                        <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</p>
              </div>
              {msg.role === "user" && <div className="h-20 w-20 flex-shrink-0" />}
            </div>
          ))}

          {streamingText && (
            <div className="flex items-start justify-start gap-3">
              {state.npcFaceImageUrl && (
                <img
                  src={state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-20 w-20 flex-shrink-0 rounded-full border-2 border-slate-700/50 object-cover"
                />
              )}
              <div className="max-w-[75%] rounded-2xl border border-slate-700/50 bg-slate-800/90 px-5 py-3 text-slate-100 shadow-lg backdrop-blur-sm">
                <div className="mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                    {state.npcName}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {streamingText}
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-blue-400" />
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {state.hints.length > 0 && !sending && (
          <div className="flex-shrink-0 border-t border-slate-800/50 bg-slate-900/50 px-6 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {state.hints.map((hint, i) => (
                <button
                  key={i}
                  onClick={() => onHintSelect(hint)}
                  className="flex-shrink-0 rounded-full border border-blue-600/30 bg-blue-600/10 px-4 py-2 text-sm text-blue-300 transition-colors hover:border-blue-600/50 hover:bg-blue-600/20"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex-shrink-0 border-t border-red-900/50 bg-red-950/30 px-6 py-2">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 p-4">
          <form onSubmit={(event) => handleSubmit(event, onSubmit)} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={
                recording
                  ? t("recording")
                  : transcribing
                    ? t("transcribing")
                    : t("messagePlaceholder", { language: tLangs(activeLanguageCode) })
              }
              disabled={sending || recording}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-3 text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="button"
              onClick={onMicToggle}
              disabled={sending || transcribing}
              title={recording ? t("stopRecording") : t("startRecording")}
              className={`rounded-xl px-4 py-3 transition-all ${
                recording
                  ? "animate-pulse bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : "border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-700/50"
              } disabled:opacity-50`}
            >
              {transcribing ? (
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
            <button
              type="submit"
              disabled={sending || !input.trim() || recording}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("send")}
            </button>
            <button
              type="button"
              onClick={onQuit}
              disabled={sending || quitting || recording}
              className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-400 transition-all hover:border-slate-600 hover:bg-slate-700/50 disabled:opacity-50"
            >
              {quitting ? "..." : t("quit")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
