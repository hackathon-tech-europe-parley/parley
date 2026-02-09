"use client";

import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { MapPage } from "@/components/scenario-map/map-page";

export default function Home() {
  const t = useTranslations("Layout");

  return (
    <>
      <main className="relative flex flex-1 items-center justify-center p-4 py-6 sm:py-8 md:py-12">
        {/* Atmospheric gradient orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/[0.04] blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-600/[0.03] blur-3xl" />
        </div>
        <Suspense>
          <MapPage />
        </Suspense>
      </main>
      <footer className="flex-shrink-0 border-t border-slate-800/40 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-3 sm:px-4 md:px-6 text-xs text-slate-500">
          <span className="tracking-wide">Parley — {t("tagline")}</span>
          <span className="text-slate-600">{t("poweredBy")}</span>
        </div>
      </footer>
    </>
  );
}
