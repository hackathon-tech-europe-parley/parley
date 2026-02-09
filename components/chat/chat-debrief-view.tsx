import type { LanguageCode } from "@/core/types";
import { Link } from "@/i18n/navigation";
import type { DebriefState } from "./chat-types";

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface ChatDebriefViewProps {
  debriefState: DebriefState;
  languageCode?: LanguageCode;
  tDebrief: TranslateFn;
  onClose: () => void;
}

export function ChatDebriefView({
  debriefState,
  languageCode,
  tDebrief,
  onClose,
}: ChatDebriefViewProps) {
  const metrics = debriefState.debrief.metrics;
  const evaluationRows = metrics
    ? [
        {
          id: "cooperation",
          label: tDebrief("cooperation"),
          value: metrics.evaluationAverages.cooperation,
        },
        {
          id: "relevance",
          label: tDebrief("relevance"),
          value: metrics.evaluationAverages.relevance,
        },
        {
          id: "politeness",
          label: tDebrief("politeness"),
          value: metrics.evaluationAverages.politeness,
        },
        {
          id: "clarity",
          label: tDebrief("clarity"),
          value: metrics.evaluationAverages.clarity,
        },
        {
          id: "taskIntent",
          label: tDebrief("taskIntent"),
          value: metrics.evaluationAverages.taskIntent,
        },
      ]
    : [];

  return (
    <div className="animate-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-modal relative max-h-[95vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700/40 bg-slate-900 shadow-2xl styled-scrollbar sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="btn-press absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition-all hover:bg-slate-800 hover:text-white sm:right-4 sm:top-4"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <title>Close</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* biome-ignore lint/performance/noImgElement: Dynamic FAL image URL */}
        <img
          src={debriefState.sceneImageUrl}
          alt="Scene"
          className="h-36 w-full rounded-t-2xl object-cover sm:h-48"
        />

        <div className="space-y-3 p-4 sm:space-y-4 sm:p-6">
          {/* Status badge + NPC name */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium sm:px-3 sm:py-1 sm:text-sm ${
                debriefState.goalStatus === "achieved"
                  ? "bg-green-900/60 text-green-300 border border-green-800/30"
                  : debriefState.goalStatus === "failed"
                    ? "bg-red-900/60 text-red-300 border border-red-800/30"
                    : "bg-yellow-900/60 text-yellow-300 border border-yellow-800/30"
              }`}
            >
              {debriefState.goalStatus === "achieved"
                ? tDebrief("goalAchieved")
                : debriefState.goalStatus === "failed"
                  ? tDebrief("goalFailed")
                  : tDebrief("quitEarly")}
            </span>
            <span className="text-xs text-slate-400 sm:text-sm">
              {tDebrief("withNpc", { npcName: debriefState.npcName })}
            </span>
          </div>

          {/* Narrative */}
          <p className="text-sm leading-relaxed text-slate-300">
            {debriefState.debrief.narrative}
          </p>

          {/* Key phrases */}
          {debriefState.debrief.keyPhrases.length > 0 && (
            <div>
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {tDebrief("keyPhrases")}
              </h3>
              <ul className="stagger-children space-y-2">
                {debriefState.debrief.keyPhrases.map((kp) => (
                  <li
                    key={kp.phrase}
                    className="flex flex-col gap-0.5 rounded-lg bg-slate-800/40 px-3 py-2 text-sm sm:flex-row sm:gap-3"
                  >
                    <span className="font-medium text-blue-400">
                      {kp.phrase}
                    </span>
                    <span className="text-slate-500">{kp.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Performance breakdown */}
          {metrics && (
            <div className="space-y-3 rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {tDebrief("performanceBreakdown")}
                </h3>
                <span className="text-xs text-slate-500">
                  {tDebrief("turnsCount", { count: metrics.turnsAnalyzed })}
                </span>
              </div>

              <div className="space-y-2">
                {evaluationRows.map((row) => (
                  <div key={row.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{row.label}</span>
                      <span className="font-[family-name:var(--font-mono)] text-slate-400">
                        {Math.round(row.value * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-700/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                        style={{ width: `${Math.round(row.value * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide text-slate-400">
                    {tDebrief("objectiveScore")}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-slate-200">
                    {Math.round(metrics.objective.score * 100)}%
                  </span>
                </div>
                <p
                  className={
                    metrics.objective.met
                      ? "text-emerald-400"
                      : "text-amber-300"
                  }
                >
                  {metrics.objective.met ? tDebrief("go") : tDebrief("noGo")}
                  {" · "}
                  {tDebrief("confidence")}{" "}
                  {Math.round(metrics.objective.confidence * 100)}%
                </p>
                {metrics.objective.blockers.length > 0 && (
                  <p className="mt-1 text-slate-400">
                    {tDebrief("blockers")}
                    {": "}
                    {metrics.objective.blockers.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky CTA footer */}
        <div className="sticky bottom-0 border-t border-slate-700/40 bg-slate-900/95 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
          <Link
            href={
              languageCode
                ? { pathname: "/", query: { lang: languageCode } }
                : "/"
            }
            className={`btn-press flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all sm:text-base ${
              debriefState.goalStatus === "achieved"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-700 shadow-emerald-600/20 hover:from-emerald-400 hover:to-emerald-600"
                : "bg-gradient-to-r from-blue-500 to-blue-700 shadow-blue-600/20 hover:from-blue-400 hover:to-blue-600"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <title>Back</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {tDebrief("returnToMap")}
          </Link>
        </div>
      </div>
    </div>
  );
}
