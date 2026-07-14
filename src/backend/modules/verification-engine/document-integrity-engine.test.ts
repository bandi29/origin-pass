import { describe, expect, it } from "vitest"
import { evaluateDocumentIntegrity } from "./document-integrity-engine"
import type { VerificationRule } from "./types"

function mockSupabase(rows: Array<{
  id: string
  verification_status: "pending" | "verified" | "expired" | "invalid"
  expires_at: string | null
}>) {
  return {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return Promise.resolve({ data: rows })
        },
      }
    },
  } as any
}

const rules: VerificationRule[] = [
  {
    id: "r1",
    ruleType: "missing_documents",
    thresholdValue: 1,
    scoreImpact: 18,
    severity: "medium",
    isActive: true,
  },
]

describe("document integrity engine", () => {
  it("flags when no documents exist", async () => {
    const findings = await evaluateDocumentIntegrity(mockSupabase([]), "p1", rules)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.ruleType).toBe("missing_documents")
  })

  it("flags invalid and expired documents", async () => {
    const findings = await evaluateDocumentIntegrity(
      mockSupabase([
        { id: "1", verification_status: "invalid", expires_at: null },
        { id: "2", verification_status: "verified", expires_at: "2020-01-01" },
      ]),
      "p1",
      rules,
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]?.metadata).toMatchObject({ invalidCount: 1, expiredCount: 1 })
  })
})
