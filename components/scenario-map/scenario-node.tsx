"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { match } from "ts-pattern";
import type { NodeStatus, ScenarioNodeState } from "@/core/progress";
import type { ScenarioDef } from "../setup-form.constants";
import type { NodePosition } from "./path-utils";

interface ScenarioNodeProps {
  scenario: ScenarioDef;
  nodeState: ScenarioNodeState;
  position: NodePosition;
  isNextAvailable: boolean;
  index: number;
  onClick: () => void;
}

function statusColor(status: NodeStatus): string {
  return match(status)
    .with("completed", () => "bg-emerald-500")
    .with("failed", () => "bg-red-500")
    .with("available", () => "bg-blue-500")
    .with("locked", () => "bg-slate-700")
    .exhaustive();
}

const nodeVariants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.06,
      type: "spring" as const,
      stiffness: 300,
      damping: 20,
    },
  }),
};

export function ScenarioNode({
  scenario,
  nodeState,
  position,
  isNextAvailable,
  index,
  onClick,
}: ScenarioNodeProps) {
  const tScenarios = useTranslations("Scenarios");
  const tLevels = useTranslations("Levels");

  const allLocked = nodeState.levels.every((l) => l.status === "locked");
  const hasCompleted = nodeState.levels.some((l) => l.status === "completed");

  const title =
    scenario.key === "__custom__"
      ? scenario.scenario
      : tScenarios(`${scenario.key}_title`);

  const borderClass = allLocked
    ? "border-slate-800/60"
    : isNextAvailable
      ? "border-blue-500"
      : hasCompleted
        ? "border-emerald-500/50"
        : "border-slate-600/40";

  return (
    <motion.button
      type="button"
      custom={index}
      variants={nodeVariants}
      initial="hidden"
      animate="visible"
      whileHover={!allLocked ? { scale: 1.08 } : undefined}
      whileTap={!allLocked ? { scale: 0.95 } : undefined}
      onClick={onClick}
      disabled={allLocked}
      className="absolute flex flex-col items-center gap-1 disabled:cursor-not-allowed"
      style={{
        left: `${position.x}%`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Circle */}
      <div
        className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-slate-900/80 sm:h-16 sm:w-16 ${borderClass} ${allLocked ? "opacity-40" : ""} ${isNextAvailable ? "node-glow" : ""}`}
      >
        <span className="text-2xl sm:text-3xl">{scenario.emoji}</span>

        {/* Completed badge */}
        {hasCompleted && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <title>Completed</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </span>
        )}

        {/* Lock overlay */}
        {allLocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/50">
            <svg
              className="h-5 w-5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <title>Locked</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Title */}
      <span className="max-w-[100px] truncate text-center text-xs font-medium text-slate-300 sm:text-sm">
        {title}
      </span>

      {/* Level dots */}
      <div className="flex gap-1">
        {nodeState.levels.map((l) => (
          <div
            key={l.level}
            className={`h-2 w-2 rounded-full ${statusColor(l.status)}`}
            title={tLevels(l.level)}
          />
        ))}
      </div>
    </motion.button>
  );
}
