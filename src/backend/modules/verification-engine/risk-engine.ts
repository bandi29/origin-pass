import type { VerificationFinding, VerificationState } from "./types"

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function verificationStatusFromRisk(
  risk: number,
): VerificationState["status"] {
  if (risk >= 71) return "high_risk"
  if (risk >= 31) return "suspicious"
  if (risk > 0) return "in_review"
  return "verified"
}

export function applyRiskFindings(
  currentRisk: number,
  findings: VerificationFinding[],
): VerificationState {
  const delta = findings.reduce((sum, finding) => sum + finding.scoreImpact, 0)
  const riskBefore = clampRisk(currentRisk)
  const riskAfter = clampRisk(riskBefore + delta)
  return {
    riskBefore,
    riskAfter,
    status: verificationStatusFromRisk(riskAfter),
  }
}
