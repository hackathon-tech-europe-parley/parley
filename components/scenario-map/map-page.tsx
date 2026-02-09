"use client";

import { useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  computeScenarioProgress,
  computeUnlockedScenarioKeys,
  type ScenarioNodeState,
} from "@/core/progress";
import type { LanguageCode, ProgressEntry } from "@/core/types";
import { LANGUAGE_CODES } from "@/core/types/constants";
import {
  LANGUAGES,
  SCENARIOS,
  type ScenarioDef,
} from "../setup-form.constants";
import { ScenarioDetailPanel } from "./scenario-detail-panel";
import { ScenarioMap } from "./scenario-map";

function parseLanguageParam(value: string | null): LanguageCode | null {
  if (!value) return null;
  return (LANGUAGE_CODES as readonly string[]).includes(value)
    ? (value as LanguageCode)
    : null;
}

function parseScenarioParam(value: string | null): ScenarioDef | null {
  if (!value) return null;
  return SCENARIOS.find((s) => s.key === value) ?? null;
}

export function MapPage() {
  const t = useTranslations("Map");
  const tLangs = useTranslations("Languages");
  const searchParams = useSearchParams();
  const nextRouter = useNextRouter();

  const [languageCode, setLanguageCode] = useState<LanguageCode | null>(() =>
    parseLanguageParam(searchParams.get("lang")),
  );
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef | null>(
    () => parseScenarioParam(searchParams.get("scenario")),
  );
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Sync state → URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (languageCode) params.set("lang", languageCode);
    if (selectedScenario) params.set("scenario", selectedScenario.key);
    const qs = params.toString();
    const target = qs ? `?${qs}` : window.location.pathname;
    nextRouter.replace(target, { scroll: false });
  }, [languageCode, selectedScenario, nextRouter]);

  // Fetch progress when language is selected
  useEffect(() => {
    if (!languageCode) return;
    setLoadingProgress(true);
    fetch("/api/progress")
      .then((res) => res.json())
      .then((data: ProgressEntry[]) => setProgress(data))
      .catch(() => setProgress([]))
      .finally(() => setLoadingProgress(false));
  }, [languageCode]);

  // Compute node states for all scenarios with scenario-level locking
  const nodeStates = new Map<string, ScenarioNodeState>();
  if (languageCode) {
    const scenarioKeys = SCENARIOS.map((s) => s.key);
    const unlockedKeys = computeUnlockedScenarioKeys(
      scenarioKeys,
      languageCode,
      progress,
    );

    for (const scenario of SCENARIOS) {
      if (unlockedKeys.has(scenario.key)) {
        nodeStates.set(
          scenario.key,
          computeScenarioProgress(scenario.key, languageCode, progress),
        );
      } else {
        nodeStates.set(scenario.key, {
          scenarioKey: scenario.key,
          levels: [
            { level: "beginner", status: "locked" },
            { level: "intermediate", status: "locked" },
            { level: "advanced", status: "locked" },
            { level: "impossible", status: "locked" },
          ],
        });
      }
    }
  }

  const handleSelectScenario = useCallback((scenario: ScenarioDef) => {
    setSelectedScenario(scenario);
  }, []);

  return (
    <div className="relative w-full max-w-5xl px-2 sm:px-4">
      {/* Title */}
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          {t("heading")}
        </h1>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          {t("subheading")}
        </p>
      </div>

      {/* Language picker */}
      {!languageCode ? (
        <div className="animate-in">
          <h2 className="mb-1 text-center text-xl font-semibold text-white">
            {t("pickLanguage")}
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            {t("pickLanguageSubtitle")}
          </p>
          <div className="stagger-children mx-auto grid max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-5">
            {LANGUAGES.map((lang) => (
              <button
                type="button"
                key={lang.code}
                onClick={() => {
                  setLanguageCode(lang.code);
                  setSelectedScenario(null);
                }}
                className="btn-press group flex flex-col items-center gap-2.5 rounded-xl border border-slate-700/40 bg-slate-900/40 p-4 transition-all duration-200 hover:scale-[1.04] hover:border-slate-600/60 hover:bg-slate-800/50"
              >
                <span className="text-3xl transition-transform duration-200 group-hover:scale-110">
                  {lang.flag}
                </span>
                <span className="text-sm font-medium text-slate-200">
                  {tLangs(lang.code)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="animate-in">
          {loadingProgress ? (
            <div className="flex items-center justify-center py-12">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
            </div>
          ) : (
            <ScenarioMap
              scenarios={SCENARIOS}
              nodeStates={nodeStates}
              onSelectScenario={handleSelectScenario}
            />
          )}
        </div>
      )}

      {/* Detail panel */}
      {selectedScenario && languageCode && (
        <ScenarioDetailPanel
          scenario={selectedScenario}
          nodeState={
            nodeStates.get(selectedScenario.key) ?? {
              scenarioKey: selectedScenario.key,
              levels: [
                { level: "beginner", status: "available" },
                { level: "intermediate", status: "locked" },
                { level: "advanced", status: "locked" },
                { level: "impossible", status: "locked" },
              ],
            }
          }
          languageCode={languageCode}
          onClose={() => setSelectedScenario(null)}
        />
      )}
    </div>
  );
}
