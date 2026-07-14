import { Package, QrCode, Loader2, RefreshCw, Settings2 } from "lucide-react"

type MerchantCatalogEmptyStateProps = {
  syncing: boolean
  syncPercent?: number
  disabled?: boolean
  onSync: () => void
  /** Navigate/scroll to the brand-defaults configuration section. */
  onConfigure?: () => void
}

/**
 * Shopify-native empty state for first-boot merchants — replaces the product
 * table until brand defaults and a catalog sync are in place. Primary action
 * routes to Brand Settings (defaults power every passport); sync is secondary.
 */
export function MerchantCatalogEmptyState({
  syncing,
  syncPercent = 0,
  disabled,
  onSync,
  onConfigure,
}: MerchantCatalogEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center rounded-lg bg-[#fafbfb] px-6 py-14 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative mb-6 flex h-[140px] w-[200px] items-center justify-center" aria-hidden>
        <div className="absolute inset-0 rounded-2xl bg-[#f1f2f3]" />
        <div className="absolute -left-1 top-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[#e3e3e3] bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
          <Package className="h-5 w-5 text-[#8c9196]" strokeWidth={1.5} />
        </div>
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e3e3e3] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
          <QrCode className="h-8 w-8 text-[#6d7175]" strokeWidth={1.25} />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-lg border border-[#e3e3e3] bg-white shadow-[0_1px_0_rgba(0,0,0,0.05)]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8c9196]">Pass</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold tracking-tight text-[#202223]">
        Set up your Digital Product Passports
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#6d7175]">
        Fill out your global brand manufacturing defaults and sync your product catalog to get audit-ready in
        minutes.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex items-center gap-2 rounded-lg bg-[#303030] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            Set up brand defaults
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSync}
          disabled={disabled || syncing}
          aria-busy={syncing}
          className={
            onConfigure
              ? "inline-flex items-center gap-2 rounded-lg border border-[#c9cccf] bg-white px-4 py-2.5 text-sm font-medium text-[#202223] transition-all duration-200 hover:bg-[#f6f6f7] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              : "inline-flex items-center gap-2 rounded-lg bg-[#303030] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          {syncing ? (syncPercent > 0 ? `Syncing… ${syncPercent}%` : "Syncing…") : "Sync Store Products"}
        </button>
      </div>
    </div>
  )
}
