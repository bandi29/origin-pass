import { clsx } from "clsx"
import type { PassportLifecycleAction } from "@/lib/passport-lifecycle-management"

type Status = "active" | "inactive" | "revoked" | "expired" | "counterfeit_flagged"

const statusStyles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  revoked: "bg-rose-50 text-rose-700 border-rose-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
  counterfeit_flagged: "bg-amber-50 text-amber-800 border-amber-200",
}

function statusLabel(status: string, lifecycleAction?: PassportLifecycleAction | null) {
  if (status === "counterfeit_flagged") return "Under investigation"
  if (status === "expired" && lifecycleAction === "deactivate") return "Deactivated"
  if (status === "revoked") return "Revoked"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function PassportStatusBadge({
  status,
  lifecycleAction = null,
}: {
  status: string
  lifecycleAction?: PassportLifecycleAction | null
}) {
  const key = status.toLowerCase().replace(/-/g, "_") as Status
  const style = statusStyles[key] ?? statusStyles.inactive
  const label = statusLabel(status, lifecycleAction)

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
