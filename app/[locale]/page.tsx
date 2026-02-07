"use client";

import { useTranslations } from "next-intl";
import { SetupForm } from "@/components/setup-form";

export default function Home() {
  const t = useTranslations("Layout");

  return (
    <>
      <main className="flex flex-1 items-center justify-center p-4 py-12">
        <SetupForm />
      </main>
      <footer className="flex-shrink-0 border-t border-slate-800/80 bg-slate-950/80">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 text-xs text-slate-500">
          <span>Parley — {t("tagline")}</span>
          <span>{t("poweredBy")}</span>
        </div>
      </footer>
    </>
  );
}
