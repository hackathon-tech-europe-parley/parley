import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});
const REPO_URL = "https://github.com/hackathon-tech-europe-parley/parley";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Layout" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body
        className={`${dmSans.variable} ${jetBrainsMono.variable} font-[family-name:var(--font-dm-sans)] flex min-h-screen flex-col`}
      >
        <NextIntlClientProvider messages={messages}>
          {/* Header */}
          <header className="sticky top-0 z-40 flex-shrink-0 border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-xl">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-4 md:px-6">
              <Link href="/" className="group flex items-center gap-2.5">
                <Image
                  src="/assets/logo.png"
                  alt="Parley"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-lg shadow-blue-600/20 transition-all group-hover:shadow-blue-500/40 group-hover:scale-105"
                />
                <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
                  Parley
                </span>
              </Link>
              <nav className="flex items-center gap-2">
                <LanguageSwitcher />
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="View repository on GitHub"
                  className="btn-press group inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 to-slate-950 text-slate-300 shadow-[inset_0_1px_0_rgba(148,163,184,0.08),0_8px_20px_rgba(2,6,23,0.35)] transition-all hover:-translate-y-0.5 hover:border-sky-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 sm:w-auto sm:gap-2 sm:px-3"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="currentColor"
                  >
                    <path d="M12 .5A12 12 0 0 0 8.2 23.9c.6.1.8-.2.8-.6v-2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1-.8.1-.8.1-.8 1.1.1 1.7 1.2 1.7 1.2 1 .1 1.8-.7 2.2-1.1.1-.7.4-1.1.7-1.3-2.6-.3-5.3-1.3-5.3-5.7 0-1.2.4-2.1 1.1-2.9-.2-.3-.5-1.5.1-3.1 0 0 .9-.3 3 .1a10.2 10.2 0 0 1 5.5 0c2.1-.4 3-.1 3-.1.6 1.6.2 2.8.1 3.1.7.8 1.1 1.7 1.1 2.9 0 4.4-2.7 5.4-5.3 5.7.4.3.8 1 .8 2v3c0 .4.2.7.8.6A12 12 0 0 0 12 .5Z" />
                  </svg>
                  <span className="hidden text-sm font-medium sm:inline">
                    GitHub
                  </span>
                </a>
              </nav>
            </div>
          </header>

          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
