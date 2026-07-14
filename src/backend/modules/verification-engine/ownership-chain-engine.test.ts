import { describe, expect, it } from "vitest"
import { evaluateOwnershipChain } from "./ownership-chain-engine"
import type { VerificationRule } from "./types"

function mockSupabase(rows: Array<{
  owner_type: "manufacturer" | "distributor" | "retailer" | "customer"
  transferred_at: string
  transfer_from: string | null
  transfer_to: string | null
}>) {
  return {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        order() {
          return Promise.resolve({ data: rows })
        },
      }
    },
  } as any
}

const rules: VerificationRule[] = [
  {
    id: "r1",
    ruleType: "ownership_break",
    thresholdValue: 1,
    scoreImpact: 30,
    severity: "high",
    isActive: true,
  },
]

describe("ownership chain engine", () => {
  it("flags chain break when ownership order regresses", async () => {
    const finding = await evaluateOwnershipChain(
      mockSupabase([
        {
          owner_type: "manufacturer",
          transferred_at: "2026-04-01T10:00:00.000Z",
          transfer_from: null,
          transfer_to: "dist",
        },
        {
          owner_type: "retailer",
          transferred_at: "2026-04-02T10:00:00.000Z",
          transfer_from: "dist",
          transfer_to: "ret",
        },
        {
          owner_type: "distributor",
          transferred_at: "2026-04-03T10:00:00.000Z",
          transfer_from: "ret",
          transfer_to: "dist2",
        },
      ]),
      "p1",
      rules,
    )
    expect(finding?.ruleType).toBe("ownership_break")
  })

  it("does not flag when chain order is valid", async () => {
    const finding = await evaluateOwnershipChain(
      mockSupabase([
        {
          owner_type: "manufacturer",
          transferred_at: "2026-04-01T10:00:00.000Z",
          transfer_from: null,
          transfer_to: "dist",
        },
        {
          owner_type: "distributor",
          transferred_at: "2026-04-02T10:00:00.000Z",
          transfer_from: "man",
          transfer_to: "ret",
        },
        {
          owner_type: "retailer",
          transferred_at: "2026-04-03T10:00:00.000Z",
          transfer_from: "dist",
          transfer_to: "cust",
        },
      ]),
      "p1",
      rules,
    )
    expect(finding).toBeNull()
  })
})
