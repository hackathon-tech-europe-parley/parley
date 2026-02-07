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
import type { ConversationState, DebriefState } from "./chat-types";

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface ChatConversationViewProps {
  state: ConversationState;
  input: string;
  sending: boolean;
  quitting: boolean;
  recording: boolean;
  transcribing: boolean;
  ttsPlaying: number | null;
  npcMuted: boolean;
  endStatus: DebriefState | null;
  error: string | null;
  t: TranslateFn;
  tDebrief: TranslateFn;
  tLevels: TranslateFn;
  tLangs: TranslateFn;
  tScenarios: TranslateFn;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onReplay: (messageIndex: number, text: string) => void;
  onHintSelect: (hint: string) => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onMicToggle: () => void;
  onMuteToggle: () => void;
  onEndStatusClick: () => void;
  onQuit: () => void;
}

function handleSubmit(event: FormEvent<HTMLFormElement>, onSubmit: () => void) {
  event.preventDefault();
  onSubmit();
}

export function ChatConversationView({
  state,
  input,
  sending,
  quitting,
  recording,
  transcribing,
  ttsPlaying,
  npcMuted,
  endStatus,
  error,
  t,
  tDebrief,
  tLevels,
  tLangs,
  tScenarios,
  messagesEndRef,
  onReplay,
  onHintSelect,
  onInputChange,
  onSubmit,
  onMicToggle,
  onMuteToggle,
  onEndStatusClick,
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
    <main className="flex h-screen min-h-0 flex-1 flex-col md:flex-row">
      {/* Left side - Meta Information: compact top bar on mobile, sidebar on md+ */}
      <div className="flex flex-shrink-0 flex-col bg-slate-950 md:min-w-0 md:flex-[0.3] md:flex-shrink">
        {/* Scene Image */}
        <div className="relative h-32 flex-shrink-0 overflow-hidden sm:h-44 md:h-64">
          <img src={state.sceneImageUrl} alt="Scene" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />
        </div>

        {/* Meta Information */}
        <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 md:flex-1 md:overflow-y-auto md:p-5">
          {/* Mood Indicator */}
          {(() => {
            const moodTheme = getMoodTheme(state.mood);
            return (
              <div
                className={`hud-panel relative rounded-xl border p-3 shadow-lg transition-all duration-700 sm:p-4 ${moodTheme.bg} ${moodTheme.border} ${moodTheme.glow}`}
              >
                <div className="flex items-center gap-3">
                  {state.npcFaceImageUrl && (
                    <img
                      src={state.npcFaceImageUrl}
                      alt={state.npcName}
                      className="h-9 w-9 flex-shrink-0 rounded-full border-2 border-slate-700/60 object-cover object-top sm:h-11 sm:w-11"
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
                        className={`text-base font-bold capitalize tracking-tight transition-colors duration-700 sm:text-lg ${moodTheme.text}`}
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
            className={`hud-panel relative rounded-xl border p-3 shadow-lg sm:p-4 md:p-5 ${
              state.level === "impossible"
                ? "border-red-800/50 bg-red-950/40"
                : "border-slate-700/50 bg-slate-900/60"
            }`}
          >
            <div className="mb-2 flex items-center justify-between sm:mb-3">
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
              className={`mb-3 text-sm font-medium leading-snug sm:mb-4 sm:text-[15px] ${
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
                    className={`h-2.5 flex-1 rounded-md transition-all duration-500 sm:h-3 ${
                      isActive
                        ? `${progressPalette[state.goalProgress]} shadow-md ${glowPalette[state.goalProgress]}`
                        : progressTrackColor
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Extra meta — hidden on mobile, visible on md+ */}
          <div className="hidden space-y-4 md:block">
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
      </div>

      {/* Right side - Messages: full width on mobile, 70% on md+ */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-slate-800 md:flex-[0.7] md:border-l md:border-t-0">
        <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 p-3 sm:space-y-4 sm:p-4 md:p-6">
          {state.history.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "npc" && (msg.npcFaceImageUrl || state.npcFaceImageUrl) && (
                <img
                  src={msg.npcFaceImageUrl || state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-8 w-8 flex-shrink-0 rounded-full border-2 border-slate-700/50 object-cover object-top sm:h-10 sm:w-10 md:h-12 md:w-12"
                />
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-lg sm:max-w-[80%] sm:px-4 sm:py-3 md:max-w-[75%] md:px-5 ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white"
                    : "border border-slate-700/50 bg-slate-800/90 text-slate-100 backdrop-blur-sm"
                }`}
              >
                {msg.role === "npc" && (
                  <div className="mb-1.5 flex items-center gap-2 sm:mb-2">
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed sm:text-[15px]">{msg.text}</p>
              </div>
              {msg.role === "user" && <div className="hidden flex-shrink-0 sm:block sm:h-10 sm:w-10 md:h-12 md:w-12" />}
            </div>
          ))}

          {sending && (
            <div className="flex items-start justify-start gap-2 sm:gap-3">
              {state.npcFaceImageUrl && (
                <img
                  src={state.npcFaceImageUrl}
                  alt={state.npcName}
                  className="h-8 w-8 flex-shrink-0 rounded-full border-2 border-slate-700/50 object-cover object-top sm:h-10 sm:w-10 md:h-12 md:w-12"
                />
              )}
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/90 px-4 py-3 shadow-lg backdrop-blur-sm sm:px-5 sm:py-4">
                <div className="mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                    {state.npcName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {endStatus && (
            <div className="flex justify-center py-3 sm:py-4">
              <div className={`rounded-full px-3 py-1 text-xs font-medium sm:px-4 sm:py-1.5 ${
                endStatus.goalStatus === "achieved"
                  ? "border border-green-800/50 bg-green-900/30 text-green-400"
                  : endStatus.goalStatus === "failed"
                    ? "border border-red-800/50 bg-red-900/30 text-red-400"
                    : "border border-amber-800/50 bg-amber-900/30 text-amber-400"
              }`}>
                {endStatus.goalStatus === "achieved"
                  ? tDebrief("goalAchieved")
                  : endStatus.goalStatus === "failed"
                    ? tDebrief("goalFailed")
                    : tDebrief("quitEarly")}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {state.hints.length > 0 && !sending && !endStatus && (
          <div className="flex-shrink-0 border-t border-slate-800/50 bg-slate-900/50 px-3 py-2 sm:px-4 sm:py-3 md:px-6">
            <div className="flex gap-2 overflow-x-auto">
              {state.hints.map((hint, i) => (
                <button
                  key={i}
                  onClick={() => onHintSelect(hint)}
                  className="flex-shrink-0 rounded-full border border-blue-600/30 bg-blue-600/10 px-3 py-1.5 text-xs text-blue-300 transition-colors hover:border-blue-600/50 hover:bg-blue-600/20 sm:px-4 sm:py-2 sm:text-sm"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex-shrink-0 border-t border-red-900/50 bg-red-950/30 px-3 py-2 sm:px-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Input / End status */}
        <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 p-2 sm:p-3 md:p-4">
          {endStatus ? (
            <button
              type="button"
              onClick={onEndStatusClick}
              className={`w-full rounded-xl p-3 text-left transition-all sm:p-4 md:p-5 ${
                endStatus.goalStatus === "achieved"
                  ? "border border-green-700/50 bg-gradient-to-r from-green-900/50 to-green-800/30 hover:from-green-900/70 hover:to-green-800/50"
                  : endStatus.goalStatus === "failed"
                    ? "border border-red-700/50 bg-gradient-to-r from-red-900/50 to-red-800/30 hover:from-red-900/70 hover:to-red-800/50"
                    : "border border-amber-700/50 bg-gradient-to-r from-amber-900/50 to-amber-800/30 hover:from-amber-900/70 hover:to-amber-800/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  {endStatus.goalStatus === "achieved" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/30 sm:h-10 sm:w-10">
                      <svg className="h-4 w-4 text-green-400 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  ) : endStatus.goalStatus === "failed" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600/30 sm:h-10 sm:w-10">
                      <svg className="h-4 w-4 text-red-400 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600/30 sm:h-10 sm:w-10">
                      <svg className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  )}
                  <div>
                    <p className={`text-sm font-semibold sm:text-base ${
                      endStatus.goalStatus === "achieved" ? "text-green-300" : endStatus.goalStatus === "failed" ? "text-red-300" : "text-amber-300"
                    }`}>
                      {endStatus.goalStatus === "achieved"
                        ? tDebrief("goalAchieved")
                        : endStatus.goalStatus === "failed"
                          ? tDebrief("goalFailed")
                          : tDebrief("quitEarly")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
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
            <form onSubmit={(event) => handleSubmit(event, onSubmit)} className="flex flex-col gap-2 sm:flex-row sm:gap-3">
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
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-white backdrop-blur-sm placeholder-slate-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:px-4 sm:py-3 sm:text-base md:px-5"
              />
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onMuteToggle}
                  title={npcMuted ? t("unmute") : t("mute")}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-slate-400 transition-all hover:border-slate-600 hover:bg-slate-700/50 sm:px-4 sm:py-3"
                >
                  {npcMuted ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onMicToggle}
                  disabled={sending || transcribing}
                  title={recording ? t("stopRecording") : t("startRecording")}
                  className={`rounded-xl px-3 py-2.5 transition-all sm:px-4 sm:py-3 ${
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
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-6 sm:py-3 sm:text-base"
                >
                  {t("send")}
                </button>
                <button
                  type="button"
                  onClick={onQuit}
                  disabled={sending || quitting || recording}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-xs text-slate-400 transition-all hover:border-slate-600 hover:bg-slate-700/50 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
                >
                  {quitting ? "..." : t("quit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
