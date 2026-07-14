import { describe, expect, it } from "vitest"
import { evaluateDuplicateScanPatterns } from "./duplicate-scan-engine"
import type { VerificationRule } from "./types"

function mockSupabase(rows: Array<{ id: string; device_fingerprint: string | null; geo_country: string | null }>) {
  return {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        gte() {
          return Promise.resolve({ data: rows })
        },
      }
    },
  } as any
}

const rules: VerificationRule[] = [
  { id: "r1", ruleType: "scan_velocity", thresholdValue: 10, scoreImpact: 25, severity: "high", isActive: true },
  { id: "r2", ruleType: "duplicate_scan", thresholdValue: 2, scoreImpact: 20, severity: "medium", isActive: true },
  { id: "r3", ruleType: "geo_mismatch", thresholdValue: 1, scoreImpact: 10, severity: "medium", isActive: true },
]

describe("duplicate scan engine", () => {
  it("triggers burst, duplicate device, and multi-country findings", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      device_fingerprint: i % 2 === 0 ? "d1" : "d2",
      geo_country: i % 3 === 0 ? "IT" : "CN",
    }))
    const findings = await evaluateDuplicateScanPatterns(
      mockSupabase(rows),
      {
        productId: "p1",
        scannedAt: new Date().toISOString(),
      },
      rules,
    )
    expect(findings.map((f) => f.ruleType)).toEqual(
      expect.arrayContaining(["scan_velocity", "duplicate_scan", "geo_mismatch"]),
    )
  })

  it("returns no findings at boundary below thresholds", async () => {
    const rows = [
      { id: "1", device_fingerprint: "d1", geo_country: "IT" },
      { id: "2", device_fingerprint: "d1", geo_country: "IT" },
    ]
    const findings = await evaluateDuplicateScanPatterns(
      mockSupabase(rows),
      {
        productId: "p1",
        scannedAt: new Date().toISOString(),
      },
      rules,
    )
    expect(findings).toHaveLength(0)
  })
})
