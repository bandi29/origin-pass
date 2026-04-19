/**
 * Authenticity dashboard — shared types and default rule templates.
 */

export type AuthenticityVerificationStatus = "verified" | "suspicious" | "failed"

export type AuthenticityRow = {
  product_id: string
  product_name: string
  batch_id: string
  qr_id: string
  last_scan_location: string
  status: AuthenticityVerificationStatus
  timestamp: string
  /** Preview panel */
  origin: string
}

export type AuthenticityMetricId =
  | "verified_products"
  | "successful_scans"
  | "failed_verifications"
  | "active_alerts"

export type AuthenticityMetric = {
  id: AuthenticityMetricId
  label: string
  value: string
  trendLabel: string
  trendUp: boolean
}

export type VerificationRuleType =
  | "location_based"
  | "frequency_based"
  | "time_based"

export type RuleAction = "flag_suspicious" | "block_verification" | "send_alert"

export type VerificationRule = {
  rule_id: string
  name: string
  description: string
  type: VerificationRuleType
  conditions: Record<string, string | number>
  action: RuleAction
  is_active: boolean
}

export type AlertIssueType = "duplicate" | "location_mismatch" | "invalid_qr"

export type AlertSeverity = "low" | "medium" | "high"

export type AlertStatus = "open" | "investigating" | "resolved"

export type CounterfeitAlert = {
  alert_id: string
  product_id: string
  product_name: string
  issue_type: AlertIssueType
  severity: AlertSeverity
  location: string
  timestamp: string
  status: AlertStatus
  scan_history: { at: string; event: string; location?: string }[]
  timeline: { at: string; label: string }[]
}

export const DEFAULT_RULES: VerificationRule[] = [
  {
    rule_id: "r-1",
    name: "Location mismatch detection",
    description: "Flags verifications when scan geolocation is far from declared product origin.",
    type: "location_based",
    conditions: { radius_km: 500 },
    action: "flag_suspicious",
    is_active: true,
  },
  {
    rule_id: "r-2",
    name: "Duplicate scan detection",
    description: "Detects the same QR being verified an unusual number of times in a short window.",
    type: "frequency_based",
    conditions: { scans: 25, window_minutes: 60 },
    action: "send_alert",
    is_active: true,
  },
  {
    rule_id: "r-3",
    name: "Expired QR validation",
    description: "Blocks verifications when a batch or QR window has passed its validity period.",
    type: "time_based",
    conditions: { enforce_expiry: 1 },
    action: "block_verification",
    is_active: true,
  },
  {
    rule_id: "r-4",
    name: "Region-based restrictions",
    description: "Requires scans to occur within an allow-listed region for high-risk SKUs.",
    type: "location_based",
    conditions: { regions: "EU, UK, CH" },
    action: "flag_suspicious",
    is_active: false,
  },
]

export function formatRuleType(t: VerificationRuleType): string {
  switch (t) {
    case "location_based":
      return "Location-based"
    case "frequency_based":
      return "Frequency-based"
    case "time_based":
      return "Time-based"
    default:
      return t
  }
}

export function formatRuleAction(a: RuleAction): string {
  switch (a) {
    case "flag_suspicious":
      return "Flag as suspicious"
    case "block_verification":
      return "Block verification"
    case "send_alert":
      return "Send alert"
    default:
      return a
  }
}

export function formatIssueType(t: AlertIssueType): string {
  switch (t) {
    case "duplicate":
      return "Duplicate scan"
    case "location_mismatch":
      return "Location mismatch"
    case "invalid_qr":
      return "Invalid QR"
    default:
      return t
  }
}
