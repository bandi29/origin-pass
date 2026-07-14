import { describe, expect, it } from "vitest"
import { evaluateImpossibleTravel } from "./impossible-travel-engine"
import type { VerificationRule } from "./types"

function mockSupabase(lastScan: {
  scanned_at: string
  latitude: number | null
  longitude: number | null
  geo_country: string | null
  geo_city: string | null
} | null) {
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
          return this
        },
        limit() {
          return Promise.resolve({ data: lastScan ? [lastScan] : [] })
        },
      }
    },
  } as any
}

const rules: VerificationRule[] = [
  {
    id: "r1",
    ruleType: "impossible_travel",
    thresholdValue: 850,
    scoreImpact: 40,
    severity: "high",
    isActive: true,
  },
]

describe("impossible travel engine", () => {
  it("flags impossible travel when inferred speed exceeds threshold", async () => {
    const finding = await evaluateImpossibleTravel(
      mockSupabase({
        scanned_at: "2026-04-25T10:00:00.000Z",
        latitude: 45.4642,
        longitude: 9.19,
        geo_country: "IT",
        geo_city: "Milan",
      }),
      {
        productId: "p1",
        scannedAt: "2026-04-25T10:10:00.000Z",
        latitude: 31.2304,
        longitude: 121.4737,
      },
      rules,
    )
    expect(finding?.ruleType).toBe("impossible_travel")
  })

  it("does not flag when below boundary threshold", async () => {
    const finding = await evaluateImpossibleTravel(
      mockSupabase({
        scanned_at: "2026-04-25T10:00:00.000Z",
        latitude: 45.4642,
        longitude: 9.19,
        geo_country: "IT",
        geo_city: "Milan",
      }),
      {
        productId: "p1",
        scannedAt: "2026-04-25T11:00:00.000Z",
        latitude: 45.465,
        longitude: 9.2,
      },
      rules,
    )
    expect(finding).toBeNull()
  })
})
