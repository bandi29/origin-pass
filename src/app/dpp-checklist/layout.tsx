import type { ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"

/**
 * English lead-magnet page lives outside [locale] so the canonical URL stays
 * /dpp-checklist. Mirrors the /blog layout so marketing chrome is identical.
 */
export default async function DppChecklistLayout({ children }: { children: ReactNode }) {
  setRequestLocale("en")
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <div className="flex min-h-screen flex-col bg-[#f7f5f1] text-slate-900">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </NextIntlClientProvider>
  )
}
