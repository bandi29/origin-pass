"use client"

import { X } from "lucide-react"

type Props = {
  /**
   * Deep link back into the embedded OriginPass app in Shopify Admin. Used only
   * as the fallback when this tab cannot be closed — never as its own button.
   */
  adminReturnHref: string | null
}

/**
 * Sticky merchant chrome on public passport pages opened with `?preview=true`.
 * Consumers scanning QR codes never see this (no preview query).
 *
 * Single action by design. "View passport" always opens this page in a NEW tab,
 * with the Admin still open behind it — so a "Back to OriginPass" link here just
 * navigated this tab to the Admin and left the merchant with two Admin tabs.
 * Closing returns them to the Admin tab they already had.
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
          <button
            type="button"
            onClick={() => {
              window.close()
              // window.close() is a no-op when the tab was not script-opened (e.g. the
              // merchant bookmarked or reloaded this URL); fall back to the Admin.
              if (adminReturnHref) {
                window.setTimeout(() => {
                  if (!window.closed) window.location.assign(adminReturnHref)
                }, 150)
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Close preview
          </button>
        </div>
      </div>
    </div>
  )
}
