import { describe, expect, it } from "vitest"
import { runInitialProductValidation } from "./validation-engine"
import type { VerificationRule } from "./types"

function mockSupabase(duplicateSkuCount: number, duplicateSerialCount: number) {
  let call = 0
  return {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        neq() {
          call += 1
          return Promise.resolve({
            count: call === 1 ? duplicateSkuCount : duplicateSerialCount,
          })
        },
      }
    },
  } as any
}

const rules: VerificationRule[] = [
  {
    id: "r1",
    ruleType: "invalid_supplier",
    thresholdValue: null,
    scoreImpact: 15,
    severity: "medium",
    isActive: true,
  },
  {
    id: "r2",
    ruleType: "duplicate_scan",
    thresholdValue: null,
    scoreImpact: 20,
    severity: "high",
    isActive: true,
  },
  {
    id: "r3",
    ruleType: "missing_documents",
    thresholdValue: null,
    scoreImpact: 10,
    severity: "medium",
    isActive: true,
  },
  {
    id: "r4",
    ruleType: "geo_mismatch",
    thresholdValue: null,
    scoreImpact: 8,
    severity: "medium",
    isActive: true,
  },
]

describe("initial product validation engine", () => {
  it("reports duplicates and missing origin/supplier", async () => {
    const findings = await runInitialProductValidation(
      mockSupabase(1, 1),
      {
        productId: "p1",
        sku: "SKU-1",
        serialNumber: "SER-1",
        originCountry: "",
        supplierId: "",
      },
      rules,
    )
    expect(findings.some((f) => f.message.includes("Duplicate SKU"))).toBe(true)
    expect(findings.some((f) => f.message.includes("Duplicate serial"))).toBe(true)
    expect(findings.some((f) => f.message.includes("Origin country is missing"))).toBe(true)
    expect(findings.some((f) => f.message.includes("Supplier reference is missing"))).toBe(true)
  })
})
