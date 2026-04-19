import { describe, it, expect } from "vitest"
import {
  mapToRegulatoryJsonLd,
  REGULATORY_README,
  type RegulatoryExportBatchData,
} from "./regulatory-export"

describe("regulatory-export", () => {
  const baseData: RegulatoryExportBatchData = {
    batch: {
      id: "batch-1",
      production_run_name: "Run 2024",
      artisan_name: "Jane Artisan",
      location: "Paris",
      produced_at: "2024-01-15T10:00:00Z",
      material_composition: [
        { material: "Organic Wool", percentage: 80 },
        { material: "Cotton", percentage: 20 },
      ],
      maintenance_instructions: "Hand wash",
      end_of_life_instructions: "Recycle",
      facility_info: "Studio Paris",
    },
    product: {
      id: "prod-1",
      name: "Handcrafted Scarf",
      story: "Story",
      materials: "Wool, Cotton",
      origin: "France",
      lifecycle: "Repairable",
      image_url: "https://example.com/img.jpg",
    },
    brand: {
      id: "brand-1",
      brand_name: "Artisan Co",
    },
    items: [{ id: "item-1", serial_id: "OP-ABC123" }],
    baseUrl: "https://example.com",
  }

  describe("mapToRegulatoryJsonLd", () => {
    it("maps to GS1-compliant JSON-LD", () => {
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-ABC123" },
        baseData
      )

      expect(result["@context"]).toBe(
        "https://gs1.github.io/Product-Data-Definitions/context.jsonld"
      )
      expect(result["@type"]).toBe("Product")
      expect(result.id).toBe("https://example.com/verify/OP-ABC123")
      expect(result.name).toBe("Handcrafted Scarf")
      expect(result.brand.name).toBe("Artisan Co")
      expect(result.brand.location).toBe("Paris")
      expect(result.composition).toEqual(["80% Organic Wool", "20% Cotton"])
      expect(result.circularity.repairInstructions).toBe("Hand wash")
      expect(result.circularity.endOfLifeInstructions).toBe("Recycle")
      expect(result.facility).toBe("Studio Paris")
      expect(result.productOrigin).toBe("France")
      expect(result.productionDate).toBe("2024-01-15")
      expect(result.image).toBe("https://example.com/img.jpg")
    })

    it("strips trailing slash from baseUrl", () => {
      const data = { ...baseData, baseUrl: "https://example.com/" }
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data
      )
      expect(result.id).toBe("https://example.com/verify/OP-X")
    })

    it("falls back to product materials when batch material_composition is empty", () => {
      const data = {
        ...baseData,
        batch: { ...baseData.batch, material_composition: null },
      }
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data
      )
      expect(result.composition).toEqual(["Wool, Cotton"])
    })

    it("uses Unknown Brand when brand_name is null", () => {
      const data = {
        ...baseData,
        brand: { ...baseData.brand, brand_name: null },
      }
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data
      )
      expect(result.brand.name).toBe("Unknown Brand")
    })

    it("omits brand location when not available", () => {
      const data = {
        ...baseData,
        batch: { ...baseData.batch, location: null },
        product: { ...baseData.product, origin: null },
      }
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data
      )
      expect(result.brand.location).toBeUndefined()
    })

    it("uses product origin as brand location fallback", () => {
      const data = {
        ...baseData,
        batch: { ...baseData.batch, location: null },
      }
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data
      )
      expect(result.brand.location).toBe("France")
    })

    it("uses Unknown facility when all facility fields empty", () => {
      const data = {
        ...baseData,
        batch: {
          ...baseData.batch,
          facility_info: null,
          location: null,
          artisan_name: null,
        },
      }
      const result = mapToRegulatoryJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data
      )
      expect(result.facility).toBe("Unknown facility")
    })
  })

  describe("REGULATORY_README", () => {
    it("contains expected content", () => {
      expect(REGULATORY_README).toContain("ORIGINPASS REGULATORY EXPORT")
      expect(REGULATORY_README).toContain("EU ESPR 2026")
      expect(REGULATORY_README).toContain("GS1 Digital Link")
    })
  })
})
