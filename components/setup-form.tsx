"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Level = "beginner" | "intermediate" | "advanced" | "impossible";

const LANGUAGES = [
  { code: "en", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "fr", flag: "\u{1F1EB}\u{1F1F7}" },
  { code: "de", flag: "\u{1F1E9}\u{1F1EA}" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "pt", flag: "\u{1F1E7}\u{1F1F7}" },
] as const;

// English names sent to the API (the AI prompt always uses English)
const LANGUAGE_ENGLISH_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
};

interface ScenarioDef {
  key: string;
  scenario: string;
  emoji: string;
}

const SCENARIOS: ScenarioDef[] = [
  {
    key: "taxi",
    scenario: "You just landed at the airport and hopped in a taxi. The driver seems friendly but the meter looks suspiciously high. You need to get to your hotel downtown.",
    emoji: "\u{1F695}",
  },
  {
    key: "cafe",
    scenario: "You walk into a cozy neighborhood caf\u00e9 for breakfast. The menu is only in the local language and the barista doesn't speak English.",
    emoji: "\u2615",
  },
  {
    key: "lost",
    scenario: "You're lost in a busy city center. Your phone is dead and you need to find your way to the main train station. A local is walking by.",
    emoji: "\u{1F5FA}\uFE0F",
  },
  {
    key: "market",
    scenario: "You're at a vibrant street market filled with handmade goods. A vendor catches your eye and starts pitching their wares enthusiastically.",
    emoji: "\u{1F6CD}\uFE0F",
  },
  {
    key: "hotel",
    scenario: "You arrive at your hotel after a long journey but the receptionist can't find your reservation. There seems to be a mix-up with the dates.",
    emoji: "\u{1F3E8}",
  },
  {
    key: "doctor",
    scenario: "You've been feeling unwell and visit a local clinic. The doctor speaks only the local language and needs to understand your symptoms.",
    emoji: "\u{1FA7A}",
  },
  {
    key: "friends",
    scenario: "You're at a local cultural event and the person next to you starts a friendly conversation. They're curious about where you're from.",
    emoji: "\u{1F389}",
  },
  {
    key: "interview",
    scenario: "You're interviewing for a position at a local company. The interviewer wants to test your language skills as part of the role requires client communication.",
    emoji: "\u{1F4BC}",
  },
  {
    key: "restaurant",
    scenario: "You ordered a specific dish at a nice restaurant, but the waiter brought something completely different. You also have food allergies to communicate.",
    emoji: "\u{1F37D}\uFE0F",
  },
  {
    key: "apartment",
    scenario: "You're looking to rent an apartment and the landlord is showing you around. You need to ask about the price, utilities, and neighborhood.",
    emoji: "\u{1F3E0}",
  },
  {
    key: "train",
    scenario: "You're at a busy train station and the departure board is confusing. A station worker notices you looking lost.",
    emoji: "\u{1F682}",
  },
  {
    key: "pharmacy",
    scenario: "You need a specific medication but the pharmacist needs to understand your situation to recommend the right product. The brand names are all different here.",
    emoji: "\u{1F48A}",
  },
];

const LEVEL_KEYS: Level[] = ["beginner", "intermediate", "advanced", "impossible"];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function SetupForm() {
  const router = useRouter();
  const t = useTranslations("SetupForm");
  const tLevels = useTranslations("Levels");
  const tLangs = useTranslations("Languages");
  const tScenarios = useTranslations("Scenarios");

  const [step, setStep] = useState<1 | 2>(1);
  const [languageCode, setLanguageCode] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("intermediate");
  const [scenarios, setScenarios] = useState(() => shuffleArray(SCENARIOS).slice(0, 4));
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom scenario state
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customScenario, setCustomScenario] = useState<{
    title: string;
    description: string;
    emoji: string;
    scenario: string;
    goals: Record<Level, string>;
  } | null>(null);

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
        const data = await res.json();
        throw new Error(data.error || "Failed to generate scenario");
      }

      const data = await res.json();
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

  async function handleStart() {
    if (!languageCode || !selectedScenario) return;
    setLoading(true);
    setError(null);

    const goal = selectedScenario.key === "__custom__" && customScenario
      ? customScenario.goals[level]
      : tScenarios(`${selectedScenario.key}_goal_${level}`);

    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: selectedScenario.scenario,
          language: LANGUAGE_ENGLISH_NAMES[languageCode],
          level,
          goal,
          scenarioKey: selectedScenario.key,
          languageCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create conversation");
      }

      const data = await res.json();
      sessionStorage.setItem(
        `parley:${data.conversationId}`,
        JSON.stringify({
          ...data,
          scenarioKey: selectedScenario.key,
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
    <div className="w-full max-w-2xl px-4">
      {/* Tagline */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {t("heading")}
        </h1>
        <p className="mt-2 text-slate-400">
          {t("subheading")}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
          <button
            key={s}
            onClick={() => {
              if (s === 1) setStep(1);
              else if (s === 2 && languageCode) setStep(2);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
              step === s
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : step > s
                  ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                  : "bg-slate-800 text-slate-500"
            }`}
          >
            {step > s ? "\u2713" : s}
          </button>
        ))}
      </div>

      {/* Step 1: Language */}
      {step === 1 && (
        <div className="animate-in">
          <h2 className="mb-1 text-center text-xl font-semibold text-white">
            {t("step1Title")}
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            {t("step1Subtitle")}
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguageCode(lang.code);
                  setStep(2);
                }}
                className={`group flex flex-col items-center gap-2 rounded-xl border p-4 transition-all hover:scale-[1.03] ${
                  languageCode === lang.code
                    ? "border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                    : "border-slate-700/50 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                <span className="text-3xl">{lang.flag}</span>
                <span className="text-sm font-medium text-slate-200">
                  {tLangs(lang.code)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Scenario + Level */}
      {step === 2 && (
        <div className="animate-in">
          <h2 className="mb-1 text-center text-xl font-semibold text-white">
            {t("step2Title")}
          </h2>
          <p className="mb-6 text-center text-sm text-slate-400">
            {t("step2Subtitle", { language: displayLanguage })}
          </p>

          {/* Level toggle */}
          <div className="mb-5 flex items-center justify-center">
            <div className="inline-flex rounded-lg bg-slate-800/80 p-1">
              {LEVEL_KEYS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                    level === l
                      ? l === "impossible"
                        ? "bg-red-600 text-white shadow-sm shadow-red-600/30"
                        : "bg-blue-600 text-white shadow-sm"
                      : l === "impossible"
                        ? "text-red-400 hover:text-red-300"
                        : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tLevels(l)}
                </button>
              ))}
            </div>
          </div>

          {/* Scenario cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scenarios.map((s) => {
              const isSelected = selectedScenario?.key === s.key;
              const title = tScenarios(`${s.key}_title`);
              const description = tScenarios(`${s.key}_description`);
              const goal = tScenarios(`${s.key}_goal_${level}`);
              return (
                <button
                  key={s.key}
                  onClick={() => setSelectedScenario(s)}
                  className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:scale-[1.01] ${
                    isSelected
                      ? "border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                      : "border-slate-700/50 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-2xl">{s.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{title}</div>
                      <div className="text-sm text-slate-400">{description}</div>
                    </div>
                  </div>
                  <div className={`mt-1 rounded-lg px-3 py-2 text-xs leading-relaxed transition-colors ${
                    isSelected
                      ? level === "impossible"
                        ? "bg-red-600/15 text-red-300"
                        : "bg-blue-600/15 text-blue-300"
                      : level === "impossible"
                        ? "bg-red-900/20 text-red-400/70"
                        : "bg-slate-800/50 text-slate-500"
                  }`}>
                    <span className="font-medium">{t("goalLabel")}</span> {goal}
                  </div>
                </button>
              );
            })}

            {/* Generated custom scenario card */}
            {customScenario && (
              <button
                onClick={() => setSelectedScenario({
                  key: "__custom__",
                  scenario: customScenario.scenario,
                  emoji: customScenario.emoji,
                })}
                className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:scale-[1.01] ${
                  selectedScenario?.key === "__custom__"
                    ? "border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-600/10"
                    : "border-slate-700/50 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-2xl">{customScenario.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{customScenario.title}</div>
                    <div className="text-sm text-slate-400">{customScenario.description}</div>
                  </div>
                </div>
                <div className={`mt-1 rounded-lg px-3 py-2 text-xs leading-relaxed transition-colors ${
                  selectedScenario?.key === "__custom__"
                    ? level === "impossible"
                      ? "bg-red-600/15 text-red-300"
                      : "bg-blue-600/15 text-blue-300"
                    : level === "impossible"
                      ? "bg-red-900/20 text-red-400/70"
                      : "bg-slate-800/50 text-slate-500"
                }`}>
                  <span className="font-medium">{t("goalLabel")}</span> {customScenario.goals[level]}
                </div>
              </button>
            )}

            {/* Create your own — input or card */}
            {creatingCustom ? (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-900/50 p-4">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={t("customPromptPlaceholder")}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateCustom}
                    disabled={!customPrompt.trim() || generatingCustom}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
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
                onClick={() => setCreatingCustom(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-900/30 p-4 text-center transition-all hover:border-slate-500 hover:bg-slate-800/50"
              >
                <span className="text-2xl">+</span>
                <span className="text-sm font-medium text-slate-400">{t("createOwn")}</span>
              </button>
            )}
          </div>

          <button
            onClick={reshuffleScenarios}
            className="mx-auto mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t("showDifferent")}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-red-900/50 px-4 py-2 text-center text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={handleStart}
            disabled={!selectedScenario || loading}
            className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
        </div>
      )}
    </div>
  );
}
