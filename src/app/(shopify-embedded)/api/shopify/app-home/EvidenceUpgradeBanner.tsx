import { Loader2, Lock, Sparkles } from "lucide-react"

/**
 * Free-plan replacement for the evidence dropzone — uploads stay disabled
 * (certificates API also enforces with 403). CTA starts Shopify Billing.
 */
export function EvidenceUpgradeBanner({
  upgrading,
  onUpgrade,
}: {
  /** True while the billing confirmation URL is being created. */
  upgrading: boolean
  onUpgrade: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e0d8ff] bg-[#f8f6ff] px-4 py-3">
      <div className="flex min-w-[220px] flex-1 items-start gap-2.5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#6a5acd]" aria-hidden />
        <div>
          <p className="text-sm font-medium text-[#2a2543]">
            Host supplier verification PDFs on Pro
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#5c5675]">
            Upgrade to attach GOTS / OEKO-TEX certificates and make your passports audit-ready —
            $29/month, billed through Shopify.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={upgrading}
        aria-busy={upgrading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#5c4ac7] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#4a3ab0] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5c4ac7] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {upgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        {upgrading ? "Opening Shopify billing…" : "Upgrade to Pro"}
      </button>
    </div>
  )
}
