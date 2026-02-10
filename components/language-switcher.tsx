"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALE_OPTIONS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selected =
    LOCALE_OPTIONS.find((option) => option.code === locale) ??
    LOCALE_OPTIONS[0];

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-base">
        <span aria-hidden="true">{selected.flag}</span>
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
        className="h-9 appearance-none rounded-md border border-slate-700/80 bg-slate-900/80 pl-8 pr-8 text-sm font-medium text-slate-100 shadow-sm hover:bg-slate-800/90 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/30 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {LOCALE_OPTIONS.map(({ code, label, flag }) => (
          <option key={code} value={code}>
            {flag} {label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-500">
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
