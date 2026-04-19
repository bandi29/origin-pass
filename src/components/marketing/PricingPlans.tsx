"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import clsx from "clsx"
import { marketingSection } from "@/components/marketing/marketingSection"
import { Button } from "@/components/ui/Button"
import { safePrimarySurfaceStyle } from "@/lib/safe-cta-surface"

const PRO_MONTHLY = 19
const PRO_ANNUAL = 190
const ANCHOR_MONTHLY = 24

const cardBase = marketingSection.card

/** Selected segment — important utilities + inline fallback (same issue as primary `Button` on some builds). */
const segmentSelectedCls = "!bg-primary !text-white shadow-sm [text-shadow:none]"
const segmentIdleCls =
  "bg-transparent text-gray-900 hover:bg-gray-50 hover:text-black"

export function PricingPlans() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly")

  const proDisplay = cycle === "monthly" ? `$${PRO_MONTHLY}` : `$${Math.round(PRO_ANNUAL / 12)}`
  const proSuffix = cycle === "monthly" ? "/month" : "/month, billed annually"
  const savings =
    cycle === "annual"
      ? `Save ~20% vs paying monthly ($${PRO_MONTHLY * 12}/yr).`
      : `Or $${PRO_ANNUAL}/year — save ~20%.`

  return (
    <div className="space-y-12">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <span className="text-sm font-medium text-gray-600">Billing</span>
        <div
          className="inline-flex rounded-xl border border-gray-200 bg-white/80 p-1 shadow-sm backdrop-blur-sm"
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
              cycle === "monthly" ? segmentSelectedCls : segmentIdleCls
            )}
            style={cycle === "monthly" ? safePrimarySurfaceStyle() : undefined}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle("annual")}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ease-out",
              cycle === "annual" ? segmentSelectedCls : segmentIdleCls
            )}
            style={cycle === "annual" ? safePrimarySurfaceStyle() : undefined}
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid gap-6 max-w-5xl mx-auto lg:grid-cols-3 lg:items-stretch">
        <div className={cardBase}>
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-600">Free</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-black">$0</span>
            <span className="text-base font-medium text-gray-400">/month</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">Try passports and QR with core limits.</p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              3 products
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Basic QR & verification pages
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Limited analytics
            </li>
          </ul>
          <p className="mt-4 text-xs text-gray-400">No credit card · Free forever plan</p>
          <Button href="/signup" variant="secondary" size="md" className="mt-6 w-full">
            Get started
          </Button>
        </div>

        <div
          className={clsx(
            cardBase,
            "relative ring-1 ring-black/10 shadow-md hover:shadow-lg"
          )}
        >
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm"
            style={safePrimarySurfaceStyle()}
          >
            Most popular
          </span>
          <div className="text-xs font-bold uppercase tracking-widest text-purple-600">Pro</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-gray-400 line-through">${ANCHOR_MONTHLY}/mo</span>
            <span className="text-3xl font-bold text-black">{proDisplay}</span>
            <span className="text-base font-medium text-gray-500">{proSuffix}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-emerald-700">{savings}</p>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Everything you need to scale trust and insights.
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              Unlimited products
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              AI story generation
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              Multi-language passports
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              Full analytics
            </li>
          </ul>
          <Button href="/signup" variant="primary" size="md" className="mt-6 w-full">
            Get started
          </Button>
        </div>

        <div className={cardBase}>
          <div className="text-xs font-bold uppercase tracking-widest text-gray-600">Business</div>
          <div className="mt-2 text-3xl font-bold text-black">Custom</div>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            For teams that need API, seats, and advanced analytics.
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" />
              Team access
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" />
              API access
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" />
              Advanced analytics & exports
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" />
              Priority support
            </li>
          </ul>
          <Button href="/support" variant="primary" size="md" className="mt-6 w-full">
            Contact sales
          </Button>
        </div>
      </div>

      <p className="max-w-2xl mx-auto text-center text-xs text-gray-400">
        Inside the product, analytics and advanced modules can show upgrade prompts — upgrade to unlock
        analytics on Free.
      </p>
    </div>
  )
}
