export type FraudSignalInput = {
  /** Scans in last 15 min (any IP) */
  recentScans: number
  /** Scans from same IP in last 15 min */
  sameIpRecentScans: number
  /** Distinct countries in last 1 hr */
  distinctCountriesLastHour?: number
  /** Scans in last 1 min (velocity) */
  scansLastMinute?: number
  /** Is this the first scan ever? (trust boost) */
  isFirstScan?: boolean
  /** Total scan count before this one */
  totalScanCount?: number
}

export type FraudSignalResult = {
  riskScore: number
  flagged: boolean
  status: "valid" | "suspicious" | "fraud"
  reason: string
}

/**
 * Fraud detection rules:
 * - 0-30: valid (green)
 * - 30-70: suspicious (yellow)
 * - 70+: fraud (red)
 */
export function runFraudDetection(input: FraudSignalInput): FraudSignalResult {
  let riskScore = 10

  // Duplicate scans: same QR many times in short period
  riskScore += Math.min(input.recentScans * 8, 60)

  // Same IP scans (strong signal)
  riskScore += Math.min(input.sameIpRecentScans * 10, 30)

  // Geographic anomaly: multi-country in 1 hr
  if ((input.distinctCountriesLastHour ?? 0) >= 2) {
    riskScore += 25
  }

  // Velocity: too many scans per minute
  if ((input.scansLastMinute ?? 0) > 5) {
    riskScore += 15
  }

  // First scan = strongest authenticity signal (trust boost)
  if (input.isFirstScan) {
    riskScore = Math.max(0, riskScore - 5)
  }

  const capped = Math.min(riskScore, 100)

  let status: FraudSignalResult["status"] = "valid"
  if (capped >= 70) status = "fraud"
  else if (capped >= 30) status = "suspicious"

  const flagged = status !== "valid"

  let reason = "No abnormal scan pattern detected."
  if (status === "fraud") {
    reason = "High-frequency or anomalous scan pattern detected."
  } else if (status === "suspicious") {
    reason = "Unusual scan activity; review recommended."
  }

  return {
    riskScore: capped,
    flagged,
    status,
    reason,
  }
}
