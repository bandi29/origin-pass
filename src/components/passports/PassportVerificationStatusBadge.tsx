import clsx from "clsx"
import type { PassportVerificationComplianceStatus } from "@/lib/passport-verification-management"
import { PASSPORT_VERIFICATION_STATUS_LABELS } from "@/lib/passport-verification-management"

const STATUS_STYLES: Record<PassportVerificationComplianceStatus, string> = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  suspended: "border-amber-200 bg-amber-50 text-amber-900",
  failed_audit: "border-rose-200 bg-rose-50 text-rose-800",
}

export function PassportVerificationStatusBadge({
  status,
  size = "md",
}: {
  status: PassportVerificationComplianceStatus
  size?: "sm" | "md"
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        STATUS_STYLES[status],
      )}
    >
      {PASSPORT_VERIFICATION_STATUS_LABELS[status]}
    </span>
  )
}
