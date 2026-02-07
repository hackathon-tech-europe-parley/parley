import { Link } from "@/i18n/navigation";
import type { DebriefState } from "./chat-types";

type TranslateFn = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

interface ChatDebriefViewProps {
  debriefState: DebriefState;
  tDebrief: TranslateFn;
}

export function ChatDebriefView({
  debriefState,
  tDebrief,
}: ChatDebriefViewProps) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 py-12">
      <img src={debriefState.sceneImageUrl} alt="Scene" className="w-full rounded-xl" />
      <div className="space-y-4 rounded-xl bg-slate-900 p-6">
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
        <p className="leading-relaxed text-slate-300">{debriefState.debrief.narrative}</p>
        {debriefState.debrief.keyPhrases.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
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
