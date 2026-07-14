import type { CounterfeitIssueType } from "@/lib/counterfeit-alerts-types"

/** Risk delta applied to products.risk_score when resolving / confirming (clamped at API). */
export const RISK_DELTA: Record<string, number> = {
  duplicate_scans: 20,
  impossible_travel: 40,
  velocity_anomaly: 25,
  qr_cloning: 35,
  location_mismatch: 15,
  false_positive_resolution: -15,
  confirmed_fraud: 60,
}

export function deltaForIssue(issue: CounterfeitIssueType): number {
  return RISK_DELTA[issue] ?? 18
}

export function computeAlertConfidence(input: {
  issue_type: CounterfeitIssueType
  scan_count: number
  risk_score_snapshot: number
  trigger_source: string
}): { score: number; breakdown: { label: string; weight: number }[] } {
  const factors: { label: string; weight: number }[] = []
  let base = 42
  switch (input.issue_type) {
    case "duplicate_scans":
      base = 55
      factors.push({ label: "Duplicate pattern", weight: 55 })
      break
    case "impossible_travel":
      base = 72
      factors.push({ label: "Geo / travel anomaly", weight: 72 })
      break
    case "invalid_qr":
    case "qr_cloning":
      base = 68
      factors.push({ label: "QR integrity", weight: 68 })
      break
    case "velocity_anomaly":
      base = 62
      factors.push({ label: "Velocity", weight: 62 })
      break
    default:
      factors.push({ label: "Rule signal", weight: base })
  }

  const scanBoost = Math.min(18, Math.max(0, Math.floor(input.scan_count / 3)))
  if (scanBoost > 0) {
    factors.push({ label: "Scan volume", weight: scanBoost })
  }

  const riskBoost = input.risk_score_snapshot >= 70 ? 12 : input.risk_score_snapshot >= 40 ? 6 : 0
  if (riskBoost > 0) {
    factors.push({ label: "Product risk context", weight: riskBoost })
  }

  const engineBoost = input.trigger_source === "verification_engine" ? 8 : 0
  if (engineBoost > 0) {
    factors.push({ label: "Engine correlation", weight: engineBoost })
  }

  const raw = base + scanBoost + riskBoost + engineBoost
  const score = Math.max(0, Math.min(100, raw))
  return { score, breakdown: factors }
}

export function clampRisk(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}
