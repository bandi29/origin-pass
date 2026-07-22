"use client"

import { ArrowLeft, X } from "lucide-react"

type Props = {
  /** Deep link back into the embedded OriginPass app in Shopify Admin. */
  adminReturnHref: string | null
}

/**
 * Sticky merchant chrome on public passport pages opened with `?preview=true`.
 * Consumers scanning QR codes never see this (no preview query).
 */
export function ShopifyMerchantPassportPreviewBar({ adminReturnHref }: Props) {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-200/80 bg-amber-50/95 text-amber-950 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800/90">
            Merchant preview
          </p>
          <p className="text-sm text-amber-950/90">
            This is the public Consumer Passport shoppers see after scanning a QR.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {adminReturnHref ? (
            <a
              href={adminReturnHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to OriginPass
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              window.close()
              // window.close() is a no-op when the tab was not script-opened; fall back to Admin.
              if (adminReturnHref) {
                window.setTimeout(() => {
                  if (!window.closed) window.location.assign(adminReturnHref)
                }, 150)
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 transition hover:bg-amber-100/80"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Close tab
          </button>
        </div>
      </div>
    </div>
  )
}
