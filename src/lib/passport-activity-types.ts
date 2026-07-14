export type PassportActivityEventType =
  | "PASSPORT_CREATED"
  | "QR_SCANNED"
  | "OWNERSHIP_CLAIMED"
  | "METADATA_UPDATED"

export type PassportActivityFilter = "all" | "scans" | "creations" | "updates"

export type PassportActivityLogEntry = {
  id: string
  eventType: PassportActivityEventType
  /** Optional override for the Event column badge (e.g. "Passport updated"). */
  eventTitle?: string
  description: string
  targetLabel: string
  targetHref: string
  occurredAt: string
  /** True for fictional preview rows — never mixed with live data without labeling. */
  isDemo?: boolean
}

export type PassportActivitySummary = {
  totalScans: number
  passportsGenerated: number
  ownershipClaims: number
  scansTrendLabel: string | null
}

export function filterPassportActivityLogs(
  logs: PassportActivityLogEntry[],
  filter: PassportActivityFilter,
): PassportActivityLogEntry[] {
  switch (filter) {
    case "scans":
      return logs.filter((row) => row.eventType === "QR_SCANNED")
    case "creations":
      return logs.filter((row) => row.eventType === "PASSPORT_CREATED")
    case "updates":
      return logs.filter((row) => row.eventType === "METADATA_UPDATED")
    default:
      return logs
  }
}

/** Audit log `action` values treated as update events for the activity stream. */
export const PASSPORT_ACTIVITY_UPDATE_AUDIT_ACTIONS = [
  "passport.updated",
  "product.updated",
  "template.modified",
  "passport_lifecycle_status_change",
  "passport_verification_manual_override",
] as const

export function passportActivityUpdateEventTitle(action: string): string {
  switch (action) {
    case "passport.updated":
    case "passport_lifecycle_status_change":
    case "passport_verification_manual_override":
      return "Passport updated"
    case "product.updated":
      return "Product updated"
    case "template.modified":
      return "Template modified"
    default:
      return "Metadata updated"
  }
}

export function passportActivityUpdateDescription(
  action: string,
  metadata: Record<string, unknown>,
): string {
  if (action === "passport_lifecycle_status_change") {
    const field =
      typeof metadata.action_label === "string"
        ? metadata.action_label
        : "Lifecycle status"
    const before = metadata.status_before
    const after = metadata.status_after
    if (before != null && after != null) {
      return `${field} changed from ${String(before)} to ${String(after)}.`
    }
    return `${field} updated.`
  }

  if (action === "passport_verification_manual_override") {
    const label =
      typeof metadata.status_label === "string"
        ? metadata.status_label
        : "Verification status"
    const before = metadata.status_before
    const after = metadata.status_after
    if (before != null && after != null) {
      return `${label} changed from ${String(before)} to ${String(after)}.`
    }
    return `${label} manually overridden.`
  }

  if (action === "product.updated") {
    const field =
      typeof metadata.field_label === "string"
        ? metadata.field_label
        : typeof metadata.field === "string"
          ? metadata.field
          : "Product field"
    const summary =
      typeof metadata.summary === "string" ? metadata.summary.trim() : ""
    return summary ? `${field} updated: ${summary}.` : `${field} updated.`
  }

  if (action === "template.modified") {
    const name =
      typeof metadata.template_name === "string"
        ? metadata.template_name
        : typeof metadata.template_key === "string"
          ? metadata.template_key
          : "Passport template"
    return `${name} layout or display settings were modified.`
  }

  if (action === "passport.updated") {
    const field =
      typeof metadata.field_label === "string"
        ? metadata.field_label
        : typeof metadata.field === "string"
          ? metadata.field
          : "Passport field"
    const summary =
      typeof metadata.summary === "string" ? metadata.summary.trim() : ""
    return summary ? `${field} updated: ${summary}.` : `${field} updated.`
  }

  return "Record metadata was updated."
}

export function formatPassportActivityTimestamp(iso: string, nowMs = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso

  const diffMs = nowMs - then
  if (diffMs < 0) return "Just now"

  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatPassportActivityTimestampDetailed(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function eventTypeBadgeClass(eventType: PassportActivityEventType): string {
  switch (eventType) {
    case "PASSPORT_CREATED":
      return "border-emerald-200/90 bg-emerald-50 text-emerald-800"
    case "QR_SCANNED":
      return "border-sky-200/90 bg-sky-50 text-sky-800"
    case "OWNERSHIP_CLAIMED":
      return "border-violet-200/90 bg-violet-50 text-violet-800"
    case "METADATA_UPDATED":
      return "border-amber-200/90 bg-amber-50 text-amber-900"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700"
  }
}

export function eventTypeLabel(eventType: PassportActivityEventType): string {
  switch (eventType) {
    case "PASSPORT_CREATED":
      return "Passport created"
    case "QR_SCANNED":
      return "QR scanned"
    case "OWNERSHIP_CLAIMED":
      return "Ownership claimed"
    case "METADATA_UPDATED":
      return "Metadata updated"
    default:
      // Unreachable for the known union; keeps a readable fallback for unknown values.
      return (eventType as string).replace(/_/g, " ")
  }
}

export function passportActivityEventLabel(entry: PassportActivityLogEntry): string {
  return entry.eventTitle?.trim() || eventTypeLabel(entry.eventType)
}
