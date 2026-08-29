import { describe, expect, it } from "vitest"
import {
  COMPLIANCE_WEIGHTS,
  calculateComplianceScore,
  complianceRiskLabelForScore,
  complianceTierForScore,
} from "./compliance-score"

/** Valid EAN-13 used across GS1 fixtures in this repo. */
const VALID_GTIN = "00810012345675"

describe("calculateComplianceScore", () => {
  it("returns 0 and Incomplete for an empty passport", () => {
    const result = calculateComplianceScore({})
    expect(result.score).toBe(0)
    expect(result.tier).toBe("Incomplete")
    expect(result.riskLabel).toBe("Missing core catalog data")
    expect(result.missingItems).toHaveLength(5)
    expect(result.satisfied).toEqual({
      gtin: false,
      origin: false,
      materials: false,
      care: false,
      documents: false,
    })
  })

  it("scores a partially filled passport (GTIN + origin + materials)", () => {
    const result = calculateComplianceScore({
      productGtin: VALID_GTIN,
      countryOfOrigin: "Vietnam",
      materialComposition: "100% Organic Cotton",
    })
    const expected =
      COMPLIANCE_WEIGHTS.gtin + COMPLIANCE_WEIGHTS.origin + COMPLIANCE_WEIGHTS.materials
    expect(result.score).toBe(expected)
    expect(result.score).toBe(70)
    expect(result.tier).toBe("Partial")
    expect(result.riskLabel).toBe("Partial - missing catalog fields")
    expect(result.missingItems.map((m) => m.id).sort()).toEqual(["care", "documents"])
  })

  it("accepts a valid variant GTIN when product GTIN is empty", () => {
    const result = calculateComplianceScore({
      variantGtins: ["", VALID_GTIN],
      countryOfOrigin: "Italy",
    })
    expect(result.satisfied.gtin).toBe(true)
    expect(result.score).toBe(COMPLIANCE_WEIGHTS.gtin + COMPLIANCE_WEIGHTS.origin)
  })

  it("ignores invalid GTIN check digits", () => {
    const result = calculateComplianceScore({
      productGtin: "00810012345678",
      variantGtins: ["123"],
    })
    expect(result.satisfied.gtin).toBe(false)
    expect(result.score).toBe(0)
  })

  it("returns 100 and Catalog Data Complete when all criteria are met", () => {
    const result = calculateComplianceScore({
      productGtin: VALID_GTIN,
      countryOfOrigin: "Portugal",
      materialComposition: "80% Wool, 20% Recycled Polyester",
      careInstructions: "Dry clean only. Repair via brand service. Recycle textile at end of life.",
      hasComplianceDocument: true,
    })
    expect(result.score).toBe(100)
    expect(result.tier).toBe("Catalog Data Complete")
    expect(result.riskLabel).toBe("Catalog data complete")
    expect(result.missingItems).toEqual([])
    expect(Object.values(result.satisfied).every(Boolean)).toBe(true)
  })

  it("treats whitespace-only fields as missing", () => {
    const result = calculateComplianceScore({
      countryOfOrigin: "   ",
      materialComposition: "\n\t",
      careInstructions: " ",
      hasComplianceDocument: false,
    })
    expect(result.satisfied.origin).toBe(false)
    expect(result.satisfied.materials).toBe(false)
    expect(result.satisfied.care).toBe(false)
    expect(result.score).toBe(0)
  })

  it("includes anchor links on missing items", () => {
    const result = calculateComplianceScore({})
    for (const item of result.missingItems) {
      expect(item.anchor).toMatch(/^#eu-score-/)
      expect(item.weight).toBeGreaterThan(0)
      expect(item.label.length).toBeGreaterThan(0)
    }
  })
})

describe("complianceTierForScore / complianceRiskLabelForScore", () => {
  it("maps score bands to tier and risk labels", () => {
    expect(complianceTierForScore(0)).toBe("Incomplete")
    expect(complianceTierForScore(49)).toBe("Incomplete")
    expect(complianceTierForScore(50)).toBe("Partial")
    expect(complianceTierForScore(85)).toBe("Partial")
    expect(complianceTierForScore(86)).toBe("Catalog Data Complete")
    expect(complianceTierForScore(100)).toBe("Catalog Data Complete")

    expect(complianceRiskLabelForScore(40)).toBe("Missing core catalog data")
    expect(complianceRiskLabelForScore(70)).toBe("Partial - missing catalog fields")
    expect(complianceRiskLabelForScore(90)).toBe("Catalog data complete")
  })
})
