import { describe, expect, it } from "vitest"
import { computeEsprComplianceScore, esprStatusForScore } from "./complianceScore"

const VALID_GTIN = "00810012345675"

const FULL_PASSPORT = {
  materialComposition: "80% cotton / 20% recycled polyester",
  countryOfOrigin: "Portugal",
  gtin: VALID_GTIN,
  gpsr: {
    euResponsiblePerson: {
      company: "EU RP GmbH",
      name: "Ada Lovelace",
      email: "rp@example.com",
      address: "Berlin, DE",
      phone: "+49 30 123",
    },
    safetyInformation: ["Keep away from open flame"],
    productIdentifiers: { gtin: VALID_GTIN, hsCode: "6109.10", batchNumber: "LOT-1" },
  },
  recycledContentPct: "20%",
  careInstructions: "Cold wash, line dry",
  hasCertificationsOrDocuments: true,
}

describe("computeEsprComplianceScore", () => {
  describe("fully populated passport", () => {
    it("returns 100% and Compliant status with no missing fields", () => {
      const result = computeEsprComplianceScore({ ...FULL_PASSPORT })
      expect(result.score).toBe(100)
      expect(result.status).toBe("Compliant")
      expect(result.missingFields).toEqual([])
      expect(result.breakdown).toEqual({ mandatory: 50, gpsr: 25, enhanced: 25 })
      expect(result.completedFields.length).toBeGreaterThanOrEqual(7)
    })
  })

  describe("mandatory field gaps", () => {
    it("drastically reduces score when GTIN/SKU and origin are missing", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "100% cotton",
      })
      expect(result.breakdown.mandatory).toBe(17) // materials only
      expect(result.score).toBe(17)
      expect(result.status).toBe("Incomplete")
      const missingIds = result.missingFields.map((f) => f.id)
      expect(missingIds).toContain("origin")
      expect(missingIds).toContain("gtin_sku")
      expect(result.missingFields.find((f) => f.id === "origin")?.label).toMatch(/origin/i)
    })

    it("lists Country of Origin and GTIN/SKU in missingFields when blank", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "Wool",
        countryOfOrigin: "",
        gtin: "",
        sku: null,
      })
      expect(result.missingFields.some((f) => f.id === "origin")).toBe(true)
      expect(result.missingFields.some((f) => f.id === "gtin_sku")).toBe(true)
    })

    it("scores mandatory block at 50 when materials, origin, and GTIN are set", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "100% cotton",
        countryOfOrigin: "Portugal",
        gtin: VALID_GTIN,
      })
      expect(result.breakdown.mandatory).toBe(50)
      expect(result.score).toBe(50)
      expect(result.status).toBe("Incomplete")
    })

    it("accepts SKU when GTIN is missing (optional identifier path)", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "Wool",
        countryOfOrigin: "IT",
        sku: "SKU-1",
      })
      expect(result.breakdown.mandatory).toBe(50)
      expect(result.missingFields.some((f) => f.id === "gtin_sku")).toBe(false)
    })
  })

  describe("GPSR and enhanced layers", () => {
    it("awards GPSR points for responsible person + safety warnings", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "Leather",
        countryOfOrigin: "FR",
        sku: "A",
        gpsr: {
          euResponsiblePerson: { name: "Ada", company: "", email: "", address: "", phone: "" },
          safetyInformation: ["Keep away from flame"],
          productIdentifiers: { gtin: "", hsCode: "", batchNumber: "" },
        },
      })
      expect(result.breakdown.gpsr).toBe(25)
      expect(result.score).toBe(75)
      expect(result.status).toBe("Warning")
    })

    it("treats GPSR as missing when euResponsiblePerson and warnings are empty", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "Cotton",
        countryOfOrigin: "PT",
        gtin: VALID_GTIN,
        gpsr: {
          euResponsiblePerson: { name: "", company: "", email: "", address: "", phone: "" },
          safetyInformation: [],
          productIdentifiers: {},
        },
      })
      expect(result.breakdown.gpsr).toBe(0)
      expect(result.missingFields.some((f) => f.id === "eu_responsible_person")).toBe(true)
      expect(result.missingFields.some((f) => f.id === "safety_warnings")).toBe(true)
    })
  })

  describe("edge cases: empty strings, nulls, invalid GTIN", () => {
    it("treats whitespace-only mandatory fields as missing", () => {
      const result = computeEsprComplianceScore({
        materialComposition: "   ",
        countryOfOrigin: "\n\t",
        careInstructions: " ",
        recycledContentPct: "  ",
      })
      expect(result.breakdown.mandatory).toBe(0)
      expect(result.breakdown.enhanced).toBe(0)
      expect(result.missingFields.some((f) => f.id === "materials")).toBe(true)
      expect(result.missingFields.some((f) => f.id === "origin")).toBe(true)
      expect(result.missingFields.some((f) => f.id === "care")).toBe(true)
    })

    it("treats null optional fields as missing without throwing", () => {
      const result = computeEsprComplianceScore({
        materialComposition: null,
        countryOfOrigin: null,
        gtin: null,
        sku: null,
        gpsr: null,
        recycledContentPct: null,
        careInstructions: null,
        hasCertificationsOrDocuments: null,
      })
      expect(result.score).toBe(0)
      expect(result.status).toBe("Incomplete")
      expect(result.missingFields.length).toBeGreaterThanOrEqual(6)
    })

    it("rejects invalid GTIN check digits (falls through to SKU if present)", () => {
      const withoutSku = computeEsprComplianceScore({
        materialComposition: "Cotton",
        countryOfOrigin: "PT",
        gtin: "00810012345678",
      })
      expect(withoutSku.missingFields.some((f) => f.id === "gtin_sku")).toBe(true)

      const withSku = computeEsprComplianceScore({
        materialComposition: "Cotton",
        countryOfOrigin: "PT",
        gtin: "00810012345678",
        sku: "FALLBACK-SKU",
      })
      expect(withSku.missingFields.some((f) => f.id === "gtin_sku")).toBe(false)
    })
  })

  describe("status thresholds", () => {
    it("maps Compliant / Warning / Incomplete correctly", () => {
      expect(esprStatusForScore(100)).toBe("Compliant")
      expect(esprStatusForScore(90)).toBe("Compliant")
      expect(esprStatusForScore(55)).toBe("Warning")
      expect(esprStatusForScore(54)).toBe("Incomplete")
      expect(esprStatusForScore(0)).toBe("Incomplete")
    })
  })
})
