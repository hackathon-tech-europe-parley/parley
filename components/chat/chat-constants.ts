import { type GoalProgress, normalizeToMoodState } from "@/core/types";

// Reverse mapping from English language names to codes.
export const LANGUAGE_CODE_MAP: Record<string, string> = {
  English: "en",
  French: "fr",
  German: "de",
  Spanish: "es",
  Portuguese: "pt",
};

export const GOAL_PROGRESS_STEPS: GoalProgress[] = [1, 2, 3, 4, 5];

export const GOAL_PROGRESS_COLORS: Record<GoalProgress, string> = {
  1: "bg-slate-600",
  2: "bg-blue-500",
  3: "bg-amber-500",
  4: "bg-orange-400",
  5: "bg-green-500",
};

export const GOAL_PROGRESS_COLORS_IMPOSSIBLE: Record<GoalProgress, string> = {
  1: "bg-red-900",
  2: "bg-rose-700",
  3: "bg-red-600",
  4: "bg-red-500",
  5: "bg-red-400",
};

// Glow shadow colors for active progress segments.
export const GOAL_PROGRESS_GLOW: Record<GoalProgress, string> = {
  1: "shadow-slate-600/40",
  2: "shadow-blue-500/40",
  3: "shadow-amber-500/40",
  4: "shadow-orange-400/40",
  5: "shadow-green-500/50",
};

export const GOAL_PROGRESS_GLOW_IMPOSSIBLE: Record<GoalProgress, string> = {
  1: "shadow-red-900/40",
  2: "shadow-rose-700/40",
  3: "shadow-red-600/40",
  4: "shadow-red-500/40",
  5: "shadow-red-400/50",
};

interface MoodTheme {
  bg: string;
  border: string;
  text: string;
  dot: string;
  glow: string;
}

// Mood visual theming — maps mood to one of the 8 core mood states and returns color scheme.
export function getMoodTheme(mood: string): MoodTheme {
  const moodState = normalizeToMoodState(mood);

  switch (moodState) {
    case "happy":
      return {
        bg: "bg-emerald-950/50",
        border: "border-emerald-700/50",
        text: "text-emerald-300",
        dot: "bg-emerald-400",
        glow: "shadow-emerald-500/20",
      };
    case "friendly":
      return {
        bg: "bg-green-950/50",
        border: "border-green-700/50",
        text: "text-green-300",
        dot: "bg-green-400",
        glow: "shadow-green-500/20",
      };
    case "neutral":
      return {
        bg: "bg-blue-950/30",
        border: "border-blue-800/30",
        text: "text-blue-300",
        dot: "bg-blue-400",
        glow: "shadow-blue-500/15",
      };
    case "skeptical":
      return {
        bg: "bg-violet-950/40",
        border: "border-violet-800/40",
        text: "text-violet-300",
        dot: "bg-violet-400",
        glow: "shadow-violet-500/20",
      };
    case "annoyed":
      return {
        bg: "bg-amber-950/40",
        border: "border-amber-800/40",
        text: "text-amber-300",
        dot: "bg-amber-400",
        glow: "shadow-amber-500/20",
      };
    case "angry":
      return {
        bg: "bg-red-950/50",
        border: "border-red-800/50",
        text: "text-red-300",
        dot: "bg-red-400",
        glow: "shadow-red-500/30",
      };
    case "sad":
      return {
        bg: "bg-indigo-950/40",
        border: "border-indigo-800/40",
        text: "text-indigo-300",
        dot: "bg-indigo-400",
        glow: "shadow-indigo-500/20",
      };
    case "surprised":
      return {
        bg: "bg-yellow-950/40",
        border: "border-yellow-800/40",
        text: "text-yellow-300",
        dot: "bg-yellow-400",
        glow: "shadow-yellow-500/20",
      };
    default:
      return {
        bg: "bg-blue-950/30",
        border: "border-blue-800/30",
        text: "text-blue-300",
        dot: "bg-blue-400",
        glow: "shadow-blue-500/15",
      };
  }
}
