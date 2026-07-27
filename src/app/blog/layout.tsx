import type { Metadata } from "next"
import type { ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { BLOG_SITE_URL } from "@/lib/blog"

/**
 * English SEO blog lives outside [locale] so canonical URLs stay /blog/*.
 * Wrap with next-intl so shared marketing chrome (SiteHeader) still works.
 */
export const metadata: Metadata = {
  metadataBase: new URL(BLOG_SITE_URL),
}

export default async function BlogLayout({ children }: { children: ReactNode }) {
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
