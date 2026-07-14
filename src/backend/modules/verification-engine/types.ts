import type { SupabaseClient } from "@supabase/supabase-js"

export type VerificationSeverity = "low" | "medium" | "high" | "critical"

export type VerificationRuleType =
  | "duplicate_scan"
  | "impossible_travel"
  | "scan_velocity"
  | "ownership_break"
  | "geo_mismatch"
  | "invalid_supplier"
  | "missing_documents"

export type VerificationFinding = {
  ruleType: VerificationRuleType
  severity: VerificationSeverity
  message: string
  scoreImpact: number
  metadata?: Record<string, unknown>
}

export type ProductValidationInput = {
  productId: string
  sku?: string | null
  serialNumber?: string | null
  originCountry?: string | null
  supplierId?: string | null
  batchId?: string | null
  materials?: Array<{ name: string; compositionPercentage?: number | null }>
}

export type ScanSignalInput = {
  productId: string
  qrIdentityId?: string | null
  organizationId?: string | null
  scannedAt: string
  geoCountry?: string | null
  geoCity?: string | null
  latitude?: number | null
  longitude?: number | null
  deviceFingerprint?: string | null
  scanSource?: string | null
}

export type VerificationRule = {
  id: string
  ruleType: VerificationRuleType
  thresholdValue: number | null
  scoreImpact: number
  severity: VerificationSeverity
  isActive: boolean
}

export type VerificationState = {
  riskBefore: number
  riskAfter: number
  status: "unverified" | "verified" | "in_review" | "suspicious" | "high_risk"
}

export type VerificationContext = {
  supabase: SupabaseClient
  organizationId: string | null
  actor: string
}
