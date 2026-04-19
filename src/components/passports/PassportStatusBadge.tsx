import { clsx } from "clsx"

type Status = "active" | "inactive" | "revoked" | "expired" | "counterfeit_flagged"

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  revoked: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-slate-100 text-slate-500 border-slate-200",
  counterfeit_flagged: "bg-rose-50 text-rose-700 border-rose-200",
}

export function PassportStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/-/g, "_") as Status
  const style = statusStyles[key] ?? statusStyles.inactive
  const label =
    status === "counterfeit_flagged" ? "Flagged" : status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style
      )}
    >
      {label}
    </span>
  )
}
