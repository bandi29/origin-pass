export type PassportLifecycleAction = "deactivate" | "flag" | "revoke"

export type PassportLifecycleReason =
  | "stolen_shipment"
  | "counterfeit_alert"
  | "product_defect_recall"
  | "end_of_lifecycle"

export const PASSPORT_LIFECYCLE_REASONS: {
  value: PassportLifecycleReason
  label: string
}[] = [
  { value: "stolen_shipment", label: "Stolen Shipment" },
  { value: "counterfeit_alert", label: "Counterfeit Alert" },
  { value: "product_defect_recall", label: "Product Defect/Recall" },
  { value: "end_of_lifecycle", label: "End of Lifecycle" },
]

export const PASSPORT_LIFECYCLE_CONFIRM_KEYWORDS: Record<PassportLifecycleAction, string> = {
  deactivate: "DEACTIVATE",
  flag: "FLAG",
  revoke: "REVOKE",
}

export const PASSPORT_LIFECYCLE_TARGET_STATUS: Record<
  PassportLifecycleAction,
  "expired" | "counterfeit_flagged" | "revoked"
> = {
  deactivate: "expired",
  flag: "counterfeit_flagged",
  revoke: "revoked",
}

export const PASSPORT_LIFECYCLE_ACTION_LABELS: Record<PassportLifecycleAction, string> = {
  deactivate: "Deactivate passport",
  flag: "Flag as under investigation",
  revoke: "Revoke passport permanently",
}

export function isPassportLifecycleReason(value: string): value is PassportLifecycleReason {
  return PASSPORT_LIFECYCLE_REASONS.some((option) => option.value === value)
}

export function isPassportLifecycleAction(value: string): value is PassportLifecycleAction {
  return value === "deactivate" || value === "flag" || value === "revoke"
}

export function lifecycleConfirmKeywordMatches(
  action: PassportLifecycleAction,
  typed: string,
): boolean {
  return typed.trim() === PASSPORT_LIFECYCLE_CONFIRM_KEYWORDS[action]
}

export function passportLifecycleActionBlocked(
  action: PassportLifecycleAction,
  currentStatus: string,
): string | null {
  const normalized = currentStatus.toLowerCase()
  if (action === "deactivate" && normalized === "expired") {
    return "This passport is already deactivated."
  }
  if (action === "flag" && normalized === "counterfeit_flagged") {
    return "This passport is already flagged for investigation."
  }
  if (action === "revoke" && normalized === "revoked") {
    return "This passport has already been permanently revoked."
  }
  if (normalized === "revoked" && action !== "revoke") {
    return "Revoked passports cannot be changed from this screen."
  }
  return null
}
