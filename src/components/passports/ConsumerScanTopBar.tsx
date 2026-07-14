"use client"

import NextLink from "next/link"
import { ShieldCheck } from "lucide-react"
import { resolvePassportPublicHref } from "@/components/templates/passport-public-href"

type Props = {
  /** Absolute brand homepage URL from passport/product metadata; omit to use locale marketing home. */
  brandHomeUrl?: string | null
  /**
   * Internal path for the OriginPass mark when no brand URL (e.g. `/fr` on localized claim pages).
   * Omit on `/p/*` routes (no intl) — defaults via `resolvePassportPublicHref("/")`.
   */
  marketingHomeHref?: string
}

/**
 * Minimal header for public scan / claim flows — logo only, never the B2B dashboard.
 * Uses `next/link` only (no `@/i18n/navigation`) so `/p/*` works without `NextIntlClientProvider`.
 */
export function ConsumerScanTopBar({ brandHomeUrl, marketingHomeHref }: Props) {
  const raw = brandHomeUrl?.trim() || null
  const isExternal = Boolean(raw && (raw.startsWith("http://") || raw.startsWith("https://")))
  const internalMarketingHome = marketingHomeHref ?? resolvePassportPublicHref("/")

  const mark = (
    <>
      {/* Brand-navy chip matches the studio sidebar and dashboard nav mark so
          the consumer header feels like it belongs to the same product family. */}
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand shadow-sm">
        <ShieldCheck className="h-4 w-4 text-white" aria-hidden />
      </span>
      <span className="text-sm font-semibold tracking-tight text-slate-900">OriginPass</span>
    </>
  )

  const linkClass =
    "flex items-center gap-2 rounded-md outline-none ring-brand/30 transition-opacity hover:opacity-90 focus-visible:ring-2"

  return (
    <header className="sticky top-0 z-40 border-b border-ds-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        {isExternal && raw ? (
          <NextLink href={raw} rel="noopener noreferrer" className={linkClass}>
            {mark}
          </NextLink>
        ) : (
          <NextLink href={internalMarketingHome} className={linkClass}>
            {mark}
          </NextLink>
        )}
      </div>
    </header>
  )
}
