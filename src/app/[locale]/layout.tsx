import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AppProviders } from "@/components/providers/AppProviders";
import { SetHtmlLang } from "@/components/layout/SetHtmlLang";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <>
      <SetHtmlLang locale={locale} />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AppProviders>{children}</AppProviders>
      </NextIntlClientProvider>
    </>
  );
}
