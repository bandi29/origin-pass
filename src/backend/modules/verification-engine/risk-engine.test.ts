import { describe, expect, it } from "vitest"
import { applyRiskFindings, verificationStatusFromRisk } from "./risk-engine"

describe("verification risk engine", () => {
  it("maps risk thresholds to expected status", () => {
    expect(verificationStatusFromRisk(0)).toBe("verified")
    expect(verificationStatusFromRisk(18)).toBe("in_review")
    expect(verificationStatusFromRisk(35)).toBe("suspicious")
    expect(verificationStatusFromRisk(82)).toBe("high_risk")
  })

  it("applies score deltas and clamps within 0..100", () => {
    const result = applyRiskFindings(20, [
      {
        ruleType: "duplicate_scan",
        severity: "medium",
        message: "duplicate",
        scoreImpact: 20,
      },
      {
        ruleType: "invalid_supplier",
        severity: "high",
        message: "supplier",
        scoreImpact: 70,
      },
    ])
    expect(result.riskBefore).toBe(20)
    expect(result.riskAfter).toBe(100)
    expect(result.status).toBe("high_risk")
  })
})
