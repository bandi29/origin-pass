"use client"

import { Lock, Sparkles, X } from "lucide-react"

/**
 * Shown when Starter Free hits the 10-passport ceiling.
 */
export function UpgradeToProModal({
  open,
  passportCount,
  onClose,
  onUpgrade,
  busy = false,
}: {
  open: boolean
  passportCount?: number
  onClose: () => void
  onUpgrade: () => void
  busy?: boolean
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-pro-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-[#e3e3e3] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-[#6d7175] hover:bg-[#f6f6f7]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f8f6ff]">
            <Lock className="h-4 w-4 text-[#5c4ac7]" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 id="upgrade-pro-title" className="text-base font-semibold text-[#202223]">
              Upgrade to Pro for up to 250 items
            </h2>
            <p className="text-sm leading-relaxed text-[#6d7175]">
              {typeof passportCount === "number"
                ? `You've used ${passportCount} of 10 passports on Starter Free.`
                : "You've reached the Starter Free passport limit (10)."}{" "}
              Pro unlocks up to 250 passports, EU language translations, PDF evidence uploads, and
              Avery / Thermal QR label exports.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#c9cccf] bg-white px-3.5 py-2 text-xs font-semibold text-[#202223] hover:bg-[#f6f6f7]"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onUpgrade}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#303030] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1a1a1a] disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {busy ? "Opening billing…" : "Upgrade to Pro"}
          </button>
        </div>
      </div>
    </div>
  )
}
