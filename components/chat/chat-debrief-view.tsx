import { Link } from "@/i18n/navigation";
import type { DebriefState } from "./chat-types";

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface ChatDebriefViewProps {
  debriefState: DebriefState;
  tDebrief: TranslateFn;
  onClose: () => void;
}

export function ChatDebriefView({
  debriefState,
  tDebrief,
  onClose,
}: ChatDebriefViewProps) {
  return (
    <div className="animate-backdrop fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-modal relative max-h-[95vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700/40 bg-slate-900 shadow-2xl styled-scrollbar sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="btn-press absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition-all hover:bg-slate-800 hover:text-white sm:right-4 sm:top-4"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Scene image */}
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
                {debriefState.debrief.keyPhrases.map((kp, i) => (
                  <li key={i} className="flex flex-col gap-0.5 rounded-lg bg-slate-800/40 px-3 py-2 text-sm sm:flex-row sm:gap-3">
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
            className="btn-press block w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-blue-600 hover:shadow-blue-500/30 sm:px-6 sm:py-3 sm:text-base"
          >
            {tDebrief("newScenario")}
          </Link>
        </div>
      </div>
    </div>
  );
}
