"use client"

import { Loader2 } from "lucide-react"
import { PAID_PLANS, type PaidPlan, type SubscriptionTier } from "@/lib/shopify-billing"

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030] focus-visible:ring-offset-1"

/**
 * Paid-plan controls for the Shopify embedded admin - cancel to Free or switch
 * Grower / Enterprise via Shopify Billing (never Paddle).
 */
export function PlanManagementCard({
  tier,
  busy,
  onCancel,
  onSwitch,
  onUpgrade,
}: {
  tier: SubscriptionTier
  busy: boolean
  onCancel: () => void
  onSwitch: (plan: PaidPlan) => void
  onUpgrade: (plan: PaidPlan) => void
}) {
  if (tier === "free") {
    return (
      <div className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#202223]">Plan - Boutique Free</p>
            <p className="text-xs leading-relaxed text-[#6d7175]">
              Evidence uploads and higher catalog limits unlock on Grower ($29/mo) or Enterprise ($79/mo), billed
              through Shopify.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpgrade("grower")}
              className={`inline-flex items-center rounded-lg bg-[#303030] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1a1a1a] disabled:opacity-60 ${focusRingClass}`}
            >
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Upgrade to Grower
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpgrade("enterprise")}
              className={`inline-flex items-center rounded-lg border border-[#c9cccf] bg-white px-3 py-1.5 text-xs font-semibold text-[#202223] transition hover:bg-[#f6f6f7] disabled:opacity-60 ${focusRingClass}`}
            >
              Enterprise
            </button>
          </div>
        </div>
      </div>
    )
  }

  const plan = PAID_PLANS[tier]
  const otherPlan: PaidPlan = tier === "grower" ? "enterprise" : "grower"
  const other = PAID_PLANS[otherPlan]

  return (
    <div className="rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#202223]">
            Plan - {plan.name} - ${plan.price}/mo
          </p>
          <p className="text-xs leading-relaxed text-[#6d7175]">
            Billed through Shopify. Cancel returns you to Free after Shopify confirms. Switching plans cancels the
            current charge and starts a new approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSwitch(otherPlan)}
            className={`inline-flex items-center rounded-lg border border-[#c9cccf] bg-white px-3 py-1.5 text-xs font-semibold text-[#202223] transition hover:bg-[#f6f6f7] disabled:opacity-60 ${focusRingClass}`}
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Switch to {other.name.replace("OriginPass ", "")} (${other.price}/mo)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`inline-flex items-center rounded-lg border border-[#fdd0cb] bg-[#fff0ed] px-3 py-1.5 text-xs font-semibold text-[#8e1b16] transition hover:bg-[#ffe9e6] disabled:opacity-60 ${focusRingClass}`}
          >
            Cancel plan
          </button>
        </div>
      </div>
    </div>
  )
}
