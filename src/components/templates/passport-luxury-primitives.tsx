import { ShoppingBag } from "lucide-react"
import { clsx } from "clsx"
import { formatBrandDisplayName } from "@/lib/format-brand-display-name"

export const PASSPORT_OWNERSHIP_PRIMARY_LABEL = "Register digital passport"

export const passportOwnershipPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"

export function PassportBrandLabel({
  brandName,
  variant = "classic",
}: {
  brandName: string
  variant?: "classic" | "luxury"
}) {
  const display = formatBrandDisplayName(brandName)
  return (
    <p
      className={clsx(
        "tracking-widest text-xs font-semibold uppercase",
        variant === "luxury" ? "text-amber-200/75" : "text-slate-500 dark:text-slate-400",
      )}
    >
      {display}
    </p>
  )
}

export function PassportImagePlaceholder({ variant = "classic" }: { variant?: "classic" | "luxury" }) {
  const isLuxury = variant === "luxury"
  return (
    <div
      className={clsx(
        "relative flex h-full w-full flex-col items-center justify-center overflow-hidden",
        isLuxury
          ? "bg-gradient-to-br from-slate-900 via-slate-950 to-black"
          : "bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950",
      )}
    >
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 opacity-[0.35]",
          isLuxury ? "text-amber-100/10" : "text-slate-400/20 dark:text-slate-500/15",
        )}
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />
      <ShoppingBag
        className={clsx(
          "relative h-14 w-14 stroke-[0.65]",
          isLuxury ? "text-amber-200/25" : "text-slate-300 dark:text-slate-600",
        )}
        aria-hidden
      />
      <span
        className={clsx(
          "relative mt-4 tracking-widest text-[10px] font-medium uppercase",
          isLuxury ? "text-amber-100/40" : "text-slate-400 dark:text-slate-500",
        )}
      >
        Awaiting atelier photography
      </span>
    </div>
  )
}
