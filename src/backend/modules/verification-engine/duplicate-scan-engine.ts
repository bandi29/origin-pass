import type { SupabaseClient } from "@supabase/supabase-js"
import { getRuleConfig } from "./rule-engine"
import type { ScanSignalInput, VerificationFinding, VerificationRule } from "./types"

type AggregateRow = {
  total: number
  unique_devices: number
  unique_countries: number
}

export async function evaluateDuplicateScanPatterns(
  supabase: SupabaseClient,
  input: ScanSignalInput,
  rules: VerificationRule[],
): Promise<VerificationFinding[]> {
  const findings: VerificationFinding[] = []
  const windowStart = new Date(new Date(input.scannedAt).getTime() - 5 * 60_000).toISOString()

  const { data } = await supabase
    .from("scan_events")
    .select("id, device_fingerprint, geo_country")
    .eq("product_id", input.productId)
    .gte("scanned_at", windowStart)

  const rows = (data ?? []) as Array<{
    id: string
    device_fingerprint: string | null
    geo_country: string | null
  }>

  const aggregate: AggregateRow = {
    total: rows.length,
    unique_devices: new Set(rows.map((r) => r.device_fingerprint ?? "na")).size,
    unique_countries: new Set(rows.map((r) => r.geo_country ?? "na")).size,
  }

  const burstRule = getRuleConfig(rules, "scan_velocity")
  const duplicateRule = getRuleConfig(rules, "duplicate_scan")
  const geoRule = getRuleConfig(rules, "geo_mismatch")

  if (aggregate.total >= (burstRule.thresholdValue ?? 10)) {
    findings.push({
      ruleType: "scan_velocity",
      severity: burstRule.severity,
      scoreImpact: burstRule.scoreImpact,
      message: "Scan burst detected in a short time window.",
      metadata: { ...aggregate, windowMinutes: 5 },
    })
  }

  if (aggregate.unique_devices >= (duplicateRule.thresholdValue ?? 2)) {
    findings.push({
      ruleType: "duplicate_scan",
      severity: duplicateRule.severity,
      scoreImpact: duplicateRule.scoreImpact,
      message: "Multiple devices scanned the same QR in rapid sequence.",
      metadata: { ...aggregate, windowMinutes: 5 },
    })
  }

  if (aggregate.unique_countries > (geoRule.thresholdValue ?? 1)) {
    findings.push({
      ruleType: "geo_mismatch",
      severity: geoRule.severity,
      scoreImpact: geoRule.scoreImpact,
      message: "Rapid scans from multiple countries indicate potential cloning.",
      metadata: { ...aggregate, windowMinutes: 5 },
    })
  }

  return findings
}
