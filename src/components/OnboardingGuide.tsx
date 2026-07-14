import { CheckCircle2, Circle, Loader2, RefreshCw, Settings2 } from "lucide-react"

type OnboardingStep = {
  title: string
  description: string
  done: boolean
  action?: React.ReactNode
}

/**
 * Dynamic native setup checklist for the Shopify embedded dashboard.
 *
 * Renders ONLY while `products.length === 0` (caller-gated). Uses Polaris-token
 * colors (`#202223`, `#6d7175`, `#e3e3e3`, `#303030`) so the card matches Shopify
 * admin chrome without requiring `@shopify/polaris` in this stack.
 */
export function OnboardingGuide({
  brandDefaultsSet,
  syncing,
  syncPercent = 0,
  syncDisabled,
  onSync,
  onConfigure,
}: {
  /** True once either brand default has a saved value. */
  brandDefaultsSet: boolean
  syncing: boolean
  syncPercent?: number
  syncDisabled?: boolean
  onSync: () => void
  onConfigure: () => void
}) {
  const steps: OnboardingStep[] = [
    {
      title: "Sync Your Catalog",
      description: 'Click “Sync Store Products” to import your Shopify catalog into OriginPass.',
      done: false, // guide only mounts while the catalog is empty
      action: (
        <button
          type="button"
          onClick={onSync}
          disabled={syncDisabled || syncing}
          aria-busy={syncing}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#303030] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          {syncing ? (syncPercent > 0 ? `Syncing… ${syncPercent}%` : "Syncing…") : "Sync Store Products"}
        </button>
      ),
    },
    {
      title: "Assign Brand Defaults",
      description: "Set global production location and care rules under Brand defaults (Settings).",
      done: brandDefaultsSet,
      action: (
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-3.5 py-2 text-xs font-medium text-[#202223] transition hover:bg-[#f6f6f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          {brandDefaultsSet ? "Review defaults" : "Set defaults"}
        </button>
      ),
    },
    {
      title: "Verify a Sample Passport",
      description:
        "After syncing, open a product’s public QR view to confirm the passport resolves live before printing labels.",
      done: false,
    },
  ]

  const completed = steps.filter((s) => s.done).length

  return (
    <section
      aria-labelledby="onboarding-guide-heading"
      className="rounded-xl border border-[#e3e3e3] bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.05)]"
    >
      <h2 id="onboarding-guide-heading" className="text-sm font-semibold text-[#202223]">
        Get Ready for EU Compliance ({completed} of {steps.length} complete)
      </h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-label="Complete" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#c9cccf]" aria-label="Incomplete" />
            )}
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-[220px] flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.done ? "text-[#6d7175] line-through" : "text-[#202223]"
                  }`}
                >
                  Step {index + 1}: {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#6d7175]">{step.description}</p>
              </div>
              {step.action}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
