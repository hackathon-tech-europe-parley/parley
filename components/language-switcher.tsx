"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  fr: "Francais",
  de: "Deutsch",
  es: "Espanol",
  pt: "Portugues",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="group relative">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500 transition-colors group-hover:text-sky-300 group-focus-within:text-sky-300">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      </div>
      <select
        value={locale}
        aria-label="Select language"
        disabled={isPending}
        onChange={(e) => {
          startTransition(() => {
            router.replace(pathname, { locale: e.target.value });
          });
        }}
        className="h-9 appearance-none rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 to-slate-950 pl-9 pr-8 text-sm font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(148,163,184,0.08),0_8px_24px_rgba(2,6,23,0.35)] transition-all hover:-translate-y-0.5 hover:border-sky-400/60 hover:text-white focus:border-sky-400/80 focus:outline-none focus:ring-2 focus:ring-sky-400/35 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {Object.entries(LOCALE_LABELS).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500 transition-colors group-hover:text-slate-300 group-focus-within:text-sky-300">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="currentColor"
        >
          <path d="M5.2 7.2a1 1 0 0 1 1.4 0L10 10.6l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 8.6a1 1 0 0 1 0-1.4Z" />
        </svg>
      </div>
    </div>
  );
}
