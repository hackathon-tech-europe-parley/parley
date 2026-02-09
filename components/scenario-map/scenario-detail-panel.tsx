"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { NodeStatus, ScenarioNodeState } from "@/core/progress";
import type { ConversationLevel, LanguageCode } from "@/core/types";
import { apiErrorSchema, createConversationResponseSchema } from "@/core/types";
import { useRouter } from "@/i18n/navigation";
import type { ScenarioDef } from "../setup-form.constants";
import { LANGUAGE_ENGLISH_NAMES } from "../setup-form.constants";

interface ScenarioDetailPanelProps {
  scenario: ScenarioDef;
  nodeState: ScenarioNodeState;
  languageCode: LanguageCode;
  onClose: () => void;
}

function statusIcon(status: NodeStatus): string {
  switch (status) {
    case "completed":
      return "\u2705";
    case "failed":
      return "\u274C";
    case "available":
      return "\u{1F7E2}";
    case "locked":
      return "\u{1F512}";
  }
}

function statusLabel(
  status: NodeStatus,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (status) {
    case "completed":
      return t("completed");
    case "failed":
      return t("failed");
    case "available":
      return t("available");
    case "locked":
      return t("locked");
  }
}

export function ScenarioDetailPanel({
  scenario,
  nodeState,
  languageCode,
  onClose,
}: ScenarioDetailPanelProps) {
  const router = useRouter();
  const t = useTranslations("Map");
  const tScenarios = useTranslations("Scenarios");
  const tLevels = useTranslations("Levels");
  const [selectedLevel, setSelectedLevel] = useState<ConversationLevel | null>(
    () => {
      // Default to first available level
      const firstAvailable = nodeState.levels.find(
        (l) => l.status === "available" || l.status === "failed",
      );
      return firstAvailable?.level ?? null;
    },
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = tScenarios(`${scenario.key}_title`);
  const description = tScenarios(`${scenario.key}_description`);

  function getGoal(level: ConversationLevel): string {
    return tScenarios(`${scenario.key}_goal_${level}`);
  }

  async function handleStart() {
    if (!selectedLevel) return;

    const levelNode = nodeState.levels.find((l) => l.level === selectedLevel);
    if (!levelNode || levelNode.status === "locked") return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenario.scenario,
          language: LANGUAGE_ENGLISH_NAMES[languageCode],
          level: selectedLevel,
          goal: getGoal(selectedLevel),
          scenarioKey: scenario.key,
          languageCode,
        }),
      });

      if (!res.ok) {
        const errorPayload = apiErrorSchema.safeParse(
          await res.json().catch(() => null),
        );
        throw new Error(
          errorPayload.success
            ? errorPayload.data.error
            : "Failed to create conversation",
        );
      }

      const parsedConversation = createConversationResponseSchema.safeParse(
        await res.json(),
      );
      if (!parsedConversation.success) {
        throw new Error("Malformed conversation payload");
      }
      const data = parsedConversation.data;
      sessionStorage.setItem(
        `parley:${data.conversationId}`,
        JSON.stringify({
          ...data,
          scenarioKey: scenario.key,
          languageCode,
        }),
      );
      router.push(`/chat/${data.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg animate-in rounded-t-2xl border border-slate-700/50 bg-slate-900 p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
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

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl">{scenario.emoji}</span>
          <div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
            {description && (
              <p className="text-sm text-slate-400">{description}</p>
            )}
          </div>
        </div>

        {/* Level selector */}
        <div className="mb-4 space-y-2">
          {nodeState.levels.map((levelNode) => {
            const isLocked = levelNode.status === "locked";
            const isSelected = selectedLevel === levelNode.level;
            const isImpossible = levelNode.level === "impossible";

            return (
              <button
                type="button"
                key={levelNode.level}
                onClick={() => {
                  if (!isLocked) setSelectedLevel(levelNode.level);
                }}
                disabled={isLocked}
                className={`btn-press flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  isLocked
                    ? "cursor-not-allowed border-slate-800/40 bg-slate-900/30 opacity-50"
                    : isSelected
                      ? isImpossible
                        ? "border-red-500/50 bg-red-600/10 shadow-lg shadow-red-600/10"
                        : "border-blue-500/50 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                      : "border-slate-700/40 bg-slate-900/40 hover:border-slate-600/60 hover:bg-slate-800/40"
                }`}
              >
                <span className="text-base">
                  {statusIcon(levelNode.status)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {tLevels(levelNode.level)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {statusLabel(levelNode.status, t)}
                    </span>
                  </div>
                  {!isLocked && (
                    <p className="mt-0.5 text-xs text-slate-400 truncate">
                      {getGoal(levelNode.level)}
                    </p>
                  )}
                  {(levelNode.status === "completed" ||
                    levelNode.status === "failed") &&
                    levelNode.score !== undefined && (
                      <div className="mt-1 flex gap-3 text-xs text-slate-500">
                        <span>
                          {t("score")}: {Math.round(levelNode.score * 100)}%
                        </span>
                        {levelNode.turnsUsed !== undefined && (
                          <span>
                            {levelNode.turnsUsed} {t("turns")}
                          </span>
                        )}
                      </div>
                    )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Start button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={!selectedLevel || loading}
          className={`btn-press w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
            selectedLevel === "impossible"
              ? "bg-gradient-to-r from-red-600 to-red-700 shadow-red-600/20 hover:from-red-500 hover:to-red-600"
              : "bg-gradient-to-r from-blue-500 to-blue-700 shadow-blue-600/20 hover:from-blue-500 hover:to-blue-600"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t("settingUp")}
            </span>
          ) : (
            t("startRoleplay")
          )}
        </button>

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-lg border border-red-800/30 bg-red-900/30 px-4 py-2 text-center text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
