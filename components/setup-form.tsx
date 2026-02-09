"use client";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import {
  apiErrorSchema,
  type CustomScenario,
  createConversationResponseSchema,
  customScenarioSchema,
  type LanguageCode,
} from "@/core/types";
import { useRouter } from "@/i18n/navigation";
import {
  LANGUAGE_ENGLISH_NAMES,
  LANGUAGES,
  LEVEL_KEYS,
  type Level,
  SCENARIOS,
  type ScenarioDef,
  shuffleArray,
} from "./setup-form.constants";

export function SetupForm() {
  const router = useRouter();
  const t = useTranslations("SetupForm");
  const tLevels = useTranslations("Levels");
  const tLangs = useTranslations("Languages");
  const tScenarios = useTranslations("Scenarios");

  const [step, setStep] = useState<1 | 2>(1);
  const [languageCode, setLanguageCode] = useState<LanguageCode | null>(null);
  const [level, setLevel] = useState<Level>("intermediate");
  const [scenarios, setScenarios] = useState(() =>
    shuffleArray(SCENARIOS).slice(0, 4),
  );
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creatingCustom, setCreatingCustom] = useState(false);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customScenario, setCustomScenario] = useState<CustomScenario | null>(
    null,
  );

  const reshuffleScenarios = useCallback(() => {
    setScenarios(shuffleArray(SCENARIOS).slice(0, 4));
    setSelectedScenario(null);
    setCustomScenario(null);
    setCreatingCustom(false);
  }, []);

  async function handleGenerateCustom() {
    if (!customPrompt.trim()) return;
    setGeneratingCustom(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: customPrompt.trim() }),
      });

      if (!res.ok) {
        const errorPayload = apiErrorSchema.safeParse(
          await res.json().catch(() => null),
        );
        throw new Error(
          errorPayload.success
            ? errorPayload.data.error
            : "Failed to generate scenario",
        );
      }

      const parsedScenario = customScenarioSchema.safeParse(await res.json());
      if (!parsedScenario.success) {
        throw new Error("Malformed scenario payload");
      }
      const data = parsedScenario.data;

      setCustomScenario(data);
      setSelectedScenario({
        key: "__custom__",
        scenario: data.scenario,
        emoji: data.emoji,
      });
      setCreatingCustom(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGeneratingCustom(false);
    }
  }

  async function handleStart(scenario: ScenarioDef) {
    if (!languageCode || !scenario) return;
    setSelectedScenario(scenario);
    setLoading(true);
    setError(null);

    const goal =
      scenario.key === "__custom__" && customScenario
        ? customScenario.goals[level]
        : tScenarios(`${scenario.key}_goal_${level}`);

    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenario.scenario,
          language: LANGUAGE_ENGLISH_NAMES[languageCode],
          level,
          goal,
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

  const displayLanguage = languageCode ? tLangs(languageCode) : "";

  return (
    <div className="relative w-full max-w-2xl px-2 sm:px-4 lg:max-w-3xl">
      {/* Header */}
      <div className="mb-6 text-center sm:mb-8 md:mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
          {t("heading")}
        </h1>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          {t("subheading")}
        </p>
      </div>

      {/* Step indicators */}
      <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
        {[1, 2].map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => {
              if (s === 1) setStep(1);
              else if (s === 2 && languageCode) setStep(2);
            }}
            className={`btn-press flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
              step === s
                ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/30 scale-110"
                : step > s
                  ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                  : "bg-slate-800/80 text-slate-500"
            }`}
          >
            {step > s ? "\u2713" : s}
          </button>
        ))}
        <div
          className={`h-px w-8 transition-colors duration-500 ${step > 1 ? "bg-blue-500/50" : "bg-slate-700/50"}`}
        />
      </div>

      {/* Step 1 — Language selection */}
      {step === 1 && (
        <div className="animate-in">
          <h2 className="mb-1 text-center text-xl font-semibold text-white">
            {t("step1Title")}
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            {t("step1Subtitle")}
          </p>
          <div className="stagger-children grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
            {LANGUAGES.map((lang) => (
              <button
                type="button"
                key={lang.code}
                onClick={() => {
                  setLanguageCode(lang.code);
                  setStep(2);
                }}
                className={`btn-press group flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all duration-200 hover:scale-[1.04] ${
                  languageCode === lang.code
                    ? "border-blue-500/60 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                    : "border-slate-700/40 bg-slate-900/40 hover:border-slate-600/60 hover:bg-slate-800/50"
                }`}
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
      )}

      {/* Step 2 — Difficulty & scenario */}
      {step === 2 && (
        <div className="animate-in">
          <h2 className="mb-1 text-center text-xl font-semibold text-white">
            {t("step2Title")}
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            {t("step2Subtitle", { language: displayLanguage })}
          </p>

          {/* Level toggle */}
          <div className="mb-5 flex items-center justify-center overflow-x-auto">
            <div className="inline-flex rounded-xl bg-slate-900/80 p-1 border border-slate-800/50">
              {LEVEL_KEYS.map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`btn-press whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-300 sm:px-4 sm:text-sm ${
                    level === l
                      ? l === "impossible"
                        ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm shadow-red-600/30"
                        : "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm shadow-blue-600/30"
                      : l === "impossible"
                        ? "text-red-400/70 hover:text-red-300"
                        : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tLevels(l)}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario cards */}
          <div className="stagger-children grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {scenarios.map((s) => {
              const isSelected = selectedScenario?.key === s.key;
              const title = tScenarios(`${s.key}_title`);
              const description = tScenarios(`${s.key}_description`);
              const goal = tScenarios(`${s.key}_goal_${level}`);
              return (
                <button
                  type="button"
                  key={s.key}
                  onClick={() => handleStart(s)}
                  disabled={loading}
                  className={`btn-press group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] ${
                    loading && selectedScenario?.key === s.key
                      ? "border-blue-500/50 bg-blue-600/10 shadow-lg shadow-blue-600/10 opacity-80"
                      : loading
                        ? "border-slate-700/40 bg-slate-900/40 opacity-50 cursor-not-allowed"
                        : isSelected
                          ? "border-blue-500/50 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                          : "border-slate-700/40 bg-slate-900/40 hover:border-slate-600/60 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-2xl transition-transform duration-200 group-hover:scale-110">
                      {s.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white">{title}</div>
                      <div className="text-sm text-slate-400">
                        {description}
                      </div>
                    </div>
                    {loading && selectedScenario?.key === s.key && (
                      <span className="mt-1 h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                    )}
                  </div>
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2.5 text-sm leading-relaxed transition-all duration-300 ${
                      isSelected
                        ? level === "impossible"
                          ? "border-red-500/40 bg-red-600/20 text-red-200"
                          : "border-blue-500/40 bg-blue-600/20 text-blue-200"
                        : level === "impossible"
                          ? "border-red-800/30 bg-red-900/25 text-red-300/90"
                          : "border-blue-800/30 bg-blue-900/25 text-blue-300/90"
                    }`}
                  >
                    <div>
                      <span className="font-semibold">{t("goalLabel")} </span>
                      <span className="font-medium">{goal}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Generated custom scenario card */}
            {customScenario && (
              <button
                type="button"
                onClick={() =>
                  handleStart({
                    key: "__custom__",
                    scenario: customScenario.scenario,
                    emoji: customScenario.emoji,
                  })
                }
                disabled={loading}
                className={`btn-press group flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] ${
                  loading && selectedScenario?.key === "__custom__"
                    ? "border-blue-500/50 bg-blue-600/10 shadow-lg shadow-blue-600/10 opacity-80"
                    : loading
                      ? "border-slate-700/40 bg-slate-900/40 opacity-50 cursor-not-allowed"
                      : selectedScenario?.key === "__custom__"
                        ? "border-blue-500/50 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                        : "border-slate-700/40 bg-slate-900/40 hover:border-slate-600/60 hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-2xl transition-transform duration-200 group-hover:scale-110">
                    {customScenario.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">
                      {customScenario.title}
                    </div>
                    <div className="text-sm text-slate-400">
                      {customScenario.description}
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-3 rounded-lg border px-3 py-2.5 text-sm leading-relaxed transition-all duration-300 ${
                    selectedScenario?.key === "__custom__"
                      ? level === "impossible"
                        ? "border-red-500/40 bg-red-600/20 text-red-200"
                        : "border-blue-500/40 bg-blue-600/20 text-blue-200"
                      : level === "impossible"
                        ? "border-red-800/30 bg-red-900/25 text-red-300/90"
                        : "border-blue-800/30 bg-blue-900/25 text-blue-300/90"
                  }`}
                >
                  <div>
                    <span className="font-semibold">{t("goalLabel")} </span>
                    <span className="font-medium">
                      {customScenario.goals[level]}
                    </span>
                  </div>
                </div>
              </button>
            )}

            {/* Create your own */}
            {creatingCustom ? (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-600/50 bg-slate-900/40 p-4">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t("customPromptPlaceholder")}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateCustom}
                    disabled={!customPrompt.trim() || generatingCustom}
                    className="btn-press flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatingCustom ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        {t("generating")}
                      </span>
                    ) : (
                      t("generate")
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingCustom(false)}
                    disabled={generatingCustom}
                    className="rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingCustom(true)}
                className="btn-press group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700/40 bg-slate-900/20 p-4 text-center transition-all hover:border-slate-500/50 hover:bg-slate-800/30"
              >
                <span className="text-2xl text-slate-500 transition-transform duration-200 group-hover:scale-110">
                  +
                </span>
                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-400">
                  {t("createOwn")}
                </span>
              </button>
            )}
          </div>

          {/* Reshuffle button */}
          <button
            type="button"
            onClick={reshuffleScenarios}
            disabled={loading}
            className="btn-press mx-auto mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-slate-400 transition-all hover:bg-slate-800/50 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <title>Refresh scenarios</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {t("showDifferent")}
          </button>

          {/* Error */}
          {error && (
            <p className="mt-4 rounded-lg border border-red-800/30 bg-red-900/30 px-4 py-2.5 text-center text-sm text-red-300">
              {error}
            </p>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="mt-6 flex items-center justify-center gap-2 text-blue-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
              <span className="text-sm font-medium">{t("settingUp")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
