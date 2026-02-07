"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
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
    <select
      value={locale}
      disabled={isPending}
      onChange={(e) => {
        startTransition(() => {
          router.replace(pathname, { locale: e.target.value });
        });
      }}
      className="rounded-lg border border-slate-800 bg-slate-900/50 px-2 py-2 text-sm text-slate-400 transition-all hover:border-slate-700 hover:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:py-1.5"
    >
      {Object.entries(LOCALE_LABELS).map(([code, label]) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
