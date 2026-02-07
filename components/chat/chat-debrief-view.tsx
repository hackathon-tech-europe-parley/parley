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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Scene image */}
        <img
          src={debriefState.sceneImageUrl}
          alt="Scene"
          className="h-48 w-full rounded-t-2xl object-cover"
        />

        <div className="space-y-4 p-6">
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
            <span className="text-sm text-slate-400">
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
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
            className="block w-full rounded-xl bg-blue-600 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-blue-500"
          >
            {tDebrief("newScenario")}
          </Link>
        </div>
      </div>
    </div>
  );
}
