import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <NextIntlClientProvider messages={messages}>
          {/* Header */}
          <header className="flex-shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-4 md:px-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                  P
                </div>
                <span className="text-base font-semibold text-white sm:text-lg">Parley</span>
              </Link>
              <nav className="flex items-center gap-1">
                <LanguageSwitcher />
                <Link
                  href="/"
                  className="hidden rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 sm:inline-block"
                >
                  {(await getTranslations("Layout"))("newSession")}
                </Link>
              </nav>
            </div>
          </header>

          {/* Content */}
          <div className="flex flex-1 flex-col">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
