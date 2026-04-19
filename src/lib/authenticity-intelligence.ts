/**
 * Authenticity intelligence — risk scoring and analytics types (data from DB via authenticity-server-data).
 */

import type { AuthenticityRow } from "@/lib/authenticity-dashboard-data"

export type ScanEvent = {
  scan_id: string
  product_id: string
  lat: number
  long: number
  timestamp: string
  /** Rough region key for mismatch heuristic */
  region_code?: string
}

export type RiskBreakdown = {
  score: number
  /** 0–100 after cap */
  capped: number
  reasons: string[]
  primaryAnomaly:
    | "—"
    | "Duplicate burst"
    | "Impossible travel"
    | "Frequency spike"
    | "Region mismatch"
    | "Multiple signals"
}

export type AnalyticsDayPoint = {
  date: string
  suspicious_count: number
}

export type TopAffectedProduct = {
  product_id: string
  product_name: string
  alert_count: number
}

export type AlertTypeSlice = {
  name: string
  value: number
  fill: string
}

export type GeoHeatRow = {
  country: string
  city: string
  lat: number
  long: number
  suspicious_scans: number
  affected_products: number
  intensity: "low" | "moderate" | "high"
}

export type AuditLogEntry = {
  event_id: string
  product_id: string
  action: "Scan" | "Verify" | "Flagged"
  result: "Success" | "Failed"
  location: string
  timestamp: string
  actor: string
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function parseTs(iso: string): number {
  return new Date(iso).getTime()
}

export function calculateRiskScore(scans: ScanEvent[]): RiskBreakdown {
  if (scans.length === 0) {
    return {
      score: 0,
      capped: 0,
      reasons: [],
      primaryAnomaly: "—",
    }
  }

  const sorted = [...scans].sort(
    (a, b) => parseTs(a.timestamp) - parseTs(b.timestamp)
  )

  let score = 0
  const reasons: string[] = []
  const reasonSet = new Set<string>()

  // +30 duplicate scans within 2 mins
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const dt = (parseTs(sorted[j]!.timestamp) - parseTs(sorted[i]!.timestamp)) / 60000
      if (dt <= 2 && dt >= 0) {
        if (!reasonSet.has("dup2")) {
          reasonSet.add("dup2")
          score += 30
          reasons.push("Duplicate scans within 2 minutes")
        }
        break
      }
      if (dt > 2) break
    }
  }

  // +25 impossible travel: > 500km in < 10 min between consecutive scans
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const cur = sorted[i]!
    const dmins =
      (parseTs(cur.timestamp) - parseTs(prev.timestamp)) / 60000
    if (dmins > 0 && dmins < 10) {
      const km = haversineKm(prev.lat, prev.long, cur.lat, cur.long)
      if (km > 500 && !reasonSet.has("travel")) {
        reasonSet.add("travel")
        score += 25
        reasons.push("Location jump > 500km in under 10 minutes")
      }
    }
  }

  // +20 more than 10 scans in any 5-minute window
  for (let i = 0; i < sorted.length; i++) {
    const t0 = parseTs(sorted[i]!.timestamp)
    let count = 1
    for (let j = i + 1; j < sorted.length; j++) {
      const dt = (parseTs(sorted[j]!.timestamp) - t0) / 60000
      if (dt <= 5) count++
      else break
    }
    if (count > 10 && !reasonSet.has("freq")) {
      reasonSet.add("freq")
      score += 20
      reasons.push("More than 10 scans within 5 minutes")
      break
    }
  }

  // +15 region mismatch: consecutive scans different region_code when provided
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!.region_code
    const b = sorted[i]!.region_code
    if (a && b && a !== b && !reasonSet.has("region")) {
      reasonSet.add("region")
      score += 15
      reasons.push("Region mismatch across consecutive scans")
      break
    }
  }

  const capped = Math.min(100, score)

  let primaryAnomaly: RiskBreakdown["primaryAnomaly"] = "—"
  if (reasons.length >= 2) primaryAnomaly = "Multiple signals"
  else if (reasons.some((r) => r.includes("Duplicate"))) primaryAnomaly = "Duplicate burst"
  else if (reasons.some((r) => r.includes("500km"))) primaryAnomaly = "Impossible travel"
  else if (reasons.some((r) => r.includes("10 scans"))) primaryAnomaly = "Frequency spike"
  else if (reasons.some((r) => r.includes("Region"))) primaryAnomaly = "Region mismatch"

  return { score, capped, reasons, primaryAnomaly }
}

export function enrichRowsWithRisk(
  rows: AuthenticityRow[],
  scansByProductId: Record<string, ScanEvent[]>
) {
  return rows.map((row) => {
    const scans = scansByProductId[row.product_id] ?? []
    const risk = calculateRiskScore(scans)
    return {
      ...row,
      risk_score: risk.capped,
      anomaly_type: risk.primaryAnomaly,
      risk_breakdown: risk,
    }
  })
}

export type EnrichedAuthenticityRow = ReturnType<
  typeof enrichRowsWithRisk
>[number]

export function riskBand(score: number): "safe" | "suspicious" | "high" {
  if (score <= 30) return "safe"
  if (score <= 70) return "suspicious"
  return "high"
}

export type FraudAnalyticsPayload = {
  timeSeries: AnalyticsDayPoint[]
  topAffected: TopAffectedProduct[]
  alertMix: AlertTypeSlice[]
  kpis: {
    totalAlerts30d: number
    highRiskProducts: number
    suspiciousSharePct: number
  }
}
