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
                <Link
                  href="/"
                  className="btn-press hidden rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-400 transition-all hover:border-slate-700 hover:bg-slate-800/80 hover:text-slate-200 sm:inline-block"
                >
                  {(await getTranslations("Layout"))("newSession")}
                </Link>
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
