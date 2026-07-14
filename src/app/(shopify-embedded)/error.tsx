"use client"

/**
 * Visible fallback when an embedded route throws during render — avoids a white iframe
 * with no feedback when App Bridge / React reconciliation fails.
 */
export default function ShopifyEmbeddedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#f6f6f7] px-5 py-8 font-sans text-[#202223]">
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-[#fdd0cb] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <h1 className="text-lg font-semibold text-[#202223]">OriginPass couldn&apos;t load</h1>
        <p className="text-sm leading-relaxed text-[#6d7175]">
          The embedded app hit an error while rendering. If you just restarted{" "}
          <code className="rounded bg-[#f6f6f7] px-1">npm run shopify:dev</code>, hard-refresh this
          admin tab so Shopify loads the new tunnel URL.
        </p>
        <p className="rounded-lg bg-[#fff0ed] px-3 py-2 text-xs text-[#8e1b16]">{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex rounded-lg bg-[#303030] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a1a1a]"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
