import type { PassportLifecycleAction } from "@/lib/passport-lifecycle-management"

const PASSPORT_STATUS_TOOLTIPS: Record<string, string> = {
  active:
    "This passport is live and publicly accessible to scanning consumers.",
  suspended:
    "Public access is temporarily paused during an administrative review.",
  revoked:
    "This identity carrier has been permanently flagged as void or fraudulent.",
}

export function getPassportStatusTooltip(
  status: string,
  lifecycleAction?: PassportLifecycleAction | null,
): string {
  const normalized = status.toLowerCase().replace(/-/g, "_")

  if (normalized === "active") {
    return PASSPORT_STATUS_TOOLTIPS.active
  }

  if (normalized === "revoked") {
    return PASSPORT_STATUS_TOOLTIPS.revoked
  }

  if (
    normalized === "expired" ||
    normalized === "inactive" ||
    normalized === "counterfeit_flagged" ||
    lifecycleAction === "deactivate" ||
    lifecycleAction === "flag"
  ) {
    return PASSPORT_STATUS_TOOLTIPS.suspended
  }

  return PASSPORT_STATUS_TOOLTIPS.active
}
