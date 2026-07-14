export type PassportVerificationComplianceStatus = "verified" | "suspended" | "failed_audit"

export type PassportVerificationEventType = "system_compliance_check" | "manual_override"

export type PassportVerificationHistoryEntry = {
  id: string
  passportId: string
  eventType: PassportVerificationEventType
  eventLabel: string
  determinedStatus: PassportVerificationComplianceStatus
  performedBy: string
  notes: string | null
  createdAt: string
}

export const PASSPORT_VERIFICATION_OVERRIDE_OPTIONS: {
  value: PassportVerificationComplianceStatus
  label: string
}[] = [
  { value: "verified", label: "Verified" },
  { value: "suspended", label: "Suspended" },
  { value: "failed_audit", label: "Failed Audit" },
]

export const PASSPORT_VERIFICATION_EVENT_LABELS: Record<PassportVerificationEventType, string> = {
  system_compliance_check: "System Automatic Compliance Check",
  manual_override: "Manual Administrator Override",
}

export const PASSPORT_VERIFICATION_STATUS_LABELS: Record<
  PassportVerificationComplianceStatus,
  string
> = {
  verified: "Verified",
  suspended: "Suspended",
  failed_audit: "Failed Audit",
}

export function isPassportVerificationComplianceStatus(
  value: string,
): value is PassportVerificationComplianceStatus {
  return value === "verified" || value === "suspended" || value === "failed_audit"
}

export function formatPassportVerificationTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}
