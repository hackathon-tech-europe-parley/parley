"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      scenario: form.get("scenario") as string,
      language: form.get("language") as string,
      level: form.get("level") as string,
      goal: form.get("goal") as string,
    };

    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create conversation");
      }

      const data = await res.json();
      sessionStorage.setItem(
        `parley:${data.conversationId}`,
        JSON.stringify(data),
      );
      router.push(`/chat/${data.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg space-y-6 rounded-2xl bg-slate-900 p-8 shadow-xl"
    >
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Parley</h1>
        <p className="mt-2 text-slate-400">
          Practice a language through immersive roleplay
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-300">Scenario</span>
          <textarea
            name="scenario"
            required
            rows={2}
            placeholder="You are in a taxi in Barcelona and want to negotiate the fare..."
            className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-300">Language</span>
          <input
            name="language"
            type="text"
            required
            placeholder="Spanish, French, Japanese..."
            className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-300">Level</span>
          <select
            name="level"
            required
            className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-300">Goal</span>
          <input
            name="goal"
            type="text"
            required
            placeholder="Convince the driver to lower the fare..."
            className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Setting up scenario...
          </span>
        ) : (
          "Start Roleplay"
        )}
      </button>
    </form>
  );
}
