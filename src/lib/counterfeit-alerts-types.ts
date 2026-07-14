/**
 * Fraud Investigation Center — types aligned with counterfeit_* DB enums.
 */

export type CounterfeitAlertStatus =
  | "new"
  | "investigating"
  | "pending_evidence"
  | "escalated"
  | "confirmed_fraud"
  | "false_positive"
  | "resolved"
  | "archived"

export type CounterfeitAlertPriority = "low" | "medium" | "high" | "critical"

export type CounterfeitAlertSeverity = "low" | "medium" | "high" | "critical"

export type CounterfeitIssueType =
  | "location_mismatch"
  | "impossible_travel"
  | "duplicate_scans"
  | "qr_cloning"
  | "velocity_anomaly"
  | "ownership_mismatch"
  | "geo_restriction_violation"
  | "suspicious_device_reuse"
  | "expired_passport_usage"
  | "invalid_supplier_activity"
  | "compliance_document_mismatch"
  | "invalid_qr"

export type CounterfeitResolutionType =
  | "legitimate_activity"
  | "customer_travel"
  | "logistics_explanation"
  | "counterfeit_confirmed"
  | "duplicate_packaging_issue"
  | "testing_activity"
  | "supplier_verification_completed"

export type CounterfeitTriggerSource =
  | "passport_scan"
  | "ownership_event"
  | "qr_validation"
  | "supplier_verification"
  | "compliance_validation"
  | "manual"
  | "verification_engine"

export type ResolutionAction =
  | "lower_risk"
  | "suspend_qr"
  | "revoke_passport"
  | "blacklist_product"
  | "whitelist_product"
  | "mark_false_positive"

export function formatCounterfeitIssueType(t: CounterfeitIssueType): string {
  const labels: Record<CounterfeitIssueType, string> = {
    location_mismatch: "Location mismatch",
    impossible_travel: "Impossible travel",
    duplicate_scans: "Duplicate scans",
    qr_cloning: "QR cloning",
    velocity_anomaly: "Velocity anomaly",
    ownership_mismatch: "Ownership mismatch",
    geo_restriction_violation: "Geo restriction violation",
    suspicious_device_reuse: "Suspicious device reuse",
    expired_passport_usage: "Expired passport usage",
    invalid_supplier_activity: "Invalid supplier activity",
    compliance_document_mismatch: "Compliance document mismatch",
    invalid_qr: "Invalid QR / verification",
  }
  return labels[t] ?? t
}

export function formatAlertStatus(s: CounterfeitAlertStatus): string {
  const labels: Record<CounterfeitAlertStatus, string> = {
    new: "New",
    investigating: "Investigating",
    pending_evidence: "Pending evidence",
    escalated: "Escalated",
    confirmed_fraud: "Confirmed fraud",
    false_positive: "False positive",
    resolved: "Resolved",
    archived: "Archived",
  }
  return labels[s] ?? s
}

export function formatTriggerSource(s: CounterfeitTriggerSource): string {
  const labels: Record<CounterfeitTriggerSource, string> = {
    passport_scan: "Passport scan",
    ownership_event: "Ownership event",
    qr_validation: "QR validation",
    supplier_verification: "Supplier verification",
    compliance_validation: "Compliance validation",
    manual: "Manual",
    verification_engine: "Verification engine",
  }
  return labels[s] ?? s
}

export type InvestigationAlertRow = {
  id: string
  investigation_ref: string
  product_id: string
  product_name: string
  sku: string | null
  batch: string | null
  passport_id: string | null
  passport_serial: string | null
  qr_identity_id: string | null
  qr_code: string | null
  issue_type: CounterfeitIssueType
  severity: CounterfeitAlertSeverity
  /** SLA / triage priority */
  priority: CounterfeitAlertPriority
  status: CounterfeitAlertStatus
  confidence_score: number
  risk_score_snapshot: number
  product_risk_score: number | null
  verification_status: string | null
  region: string | null
  last_scan_at: string | null
  scan_count: number
  trigger_source: CounterfeitTriggerSource
  assigned_to: string | null
  assignee_label: string | null
  sla_due_at: string | null
  created_at: string
  source_rule_id: string | null
  /** True when SLA passed and alert still actionable */
  is_overdue: boolean
  /** Pinned / pulse for critical open alerts */
  is_critical_open: boolean
}

export type InvestigationAlertDetail = InvestigationAlertRow & {
  evidence_snapshot: Record<string, unknown>
  event_metadata: Record<string, unknown>
  investigation_notes: string | null
  resolution_type: CounterfeitResolutionType | null
  resolution_notes: string | null
  resolved_at: string | null
  resolved_by: string | null
  timeline: InvestigationTimelineEntry[]
  evidence: InvestigationEvidenceItem[]
  comments: InvestigationComment[]
  map_points: InvestigationMapPoint[]
  status_history: StatusHistoryEntry[]
  analytics_hint: ConfidenceBreakdown
}

export type InvestigationTimelineEntry = {
  at: string
  kind: "scan" | "status" | "verification" | "comment" | "assignment" | "rule"
  label: string
  detail?: string
}

export type InvestigationEvidenceItem = {
  id: string
  evidence_type: string
  payload: Record<string, unknown>
  source: string | null
  created_at: string
}

export type InvestigationComment = {
  id: string
  body: string
  author_id: string | null
  created_at: string
  is_internal: boolean
}

export type InvestigationMapPoint = {
  id: string
  lat: number
  long: number
  label: string
  at: string
  kind: "scan" | "alert"
}

export type StatusHistoryEntry = {
  id: string
  from_status: CounterfeitAlertStatus | null
  to_status: CounterfeitAlertStatus
  at: string
  note: string | null
}

export type ConfidenceBreakdown = {
  total: number
  factors: { label: string; weight: number }[]
}

export type InvestigationSummary = {
  total_open: number
  critical_open: number
  overdue: number
  by_issue_type: { type: CounterfeitIssueType; count: number }[]
  by_status: { status: CounterfeitAlertStatus; count: number }[]
  alerts_per_day: { day: string; count: number }[]
  avg_confidence: number
  false_positive_rate: number | null
}
