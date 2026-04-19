import { describe, it, expect } from "vitest"
import {
  mapItemToJsonLd,
  buildProductJsonLd,
  buildManifest,
  type BatchExportData,
} from "./dpp-export"

describe("dpp-export", () => {
  const baseBatchData: BatchExportData = {
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
      maintenance_instructions: "Hand wash only",
      end_of_life_instructions: "Recycle textiles",
      facility_info: "Studio Paris",
    },
    product: {
      id: "prod-1",
      name: "Handcrafted Scarf",
      story: "Made with love",
      materials: "Wool, Cotton",
      origin: "France",
      lifecycle: "Repairable: Yes",
      image_url: "https://example.com/scarf.jpg",
    },
    brand: {
      id: "brand-1",
      brand_name: "Artisan Co",
    },
    items: [
      { id: "item-1", serial_id: "OP-ABC123" },
    ],
  }

  describe("mapItemToJsonLd", () => {
    it("maps item to ESPR 2026 JSON-LD structure", () => {
      const result = mapItemToJsonLd(
        { id: "item-1", serial_id: "OP-ABC123" },
        baseBatchData,
        "https://example.com"
      )

      expect(result["@context"]).toContain("https://schema.org")
      expect(result["@type"]).toContain("Product")
      expect(result["@type"]).toContain("DigitalProductPassport")
      expect(result.uniqueProductIdentifier).toBe("https://example.com/verify/OP-ABC123")
      expect(result.name).toBe("Handcrafted Scarf")
      expect(result.description).toBe("Made with love")
      expect(result.materialComposition).toEqual([
        { material: "Organic Wool", percentage: 80 },
        { material: "Cotton", percentage: 20 },
      ])
      expect(result.facilityIdentifier).toBe("Studio Paris")
      expect(result.circularityInfo.careInstructions).toBe("Hand wash only")
      expect(result.circularityInfo.repairInstructions).toBe("Hand wash only")
      expect(result.circularityInfo.endOfLifeInstructions).toBe("Recycle textiles")
      expect(result.productOrigin).toBe("France")
      expect(result.productionDate).toBe("2024-01-15")
      expect(result.brand).toEqual({ "@type": "Brand", name: "Artisan Co" })
      expect(result.image).toBe("https://example.com/scarf.jpg")
    })

    it("strips trailing slash from baseUrl", () => {
      const result = mapItemToJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        baseBatchData,
        "https://example.com/"
      )
      expect(result.uniqueProductIdentifier).toBe("https://example.com/verify/OP-X")
    })

    it("falls back to product materials when batch material_composition is empty", () => {
      const data = {
        ...baseBatchData,
        batch: {
          ...baseBatchData.batch,
          material_composition: null,
        },
      }
      const result = mapItemToJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data,
        "https://example.com"
      )
      expect(result.materialComposition).toEqual([
        { material: "Wool, Cotton", percentage: 100 },
      ])
    })

    it("falls back to location/artisan when facility_info is missing", () => {
      const data = {
        ...baseBatchData,
        batch: {
          ...baseBatchData.batch,
          facility_info: null,
          location: "Berlin",
        },
      }
      const result = mapItemToJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data,
        "https://example.com"
      )
      expect(result.facilityIdentifier).toBe("Berlin")
    })

    it("uses Unknown facility when all facility fields are empty", () => {
      const data = {
        ...baseBatchData,
        batch: {
          ...baseBatchData.batch,
          facility_info: null,
          location: null,
          artisan_name: null,
        },
      }
      const result = mapItemToJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data,
        "https://example.com"
      )
      expect(result.facilityIdentifier).toBe("Unknown facility")
    })

    it("omits optional fields when null", () => {
      const data = {
        ...baseBatchData,
        product: {
          ...baseBatchData.product,
          story: null,
          image_url: null,
        },
        brand: { id: "brand-1", brand_name: null },
      }
      const result = mapItemToJsonLd(
        { id: "item-1", serial_id: "OP-X" },
        data,
        "https://example.com"
      )
      expect(result.description).toBeUndefined()
      expect(result.image).toBeUndefined()
      expect(result.brand).toBeUndefined()
    })
  })

  describe("buildProductJsonLd", () => {
    it("builds product JSON-LD from params", () => {
      const result = buildProductJsonLd({
        name: "Scarf",
        story: "Story",
        materials: "Wool, Cotton",
        origin: "France",
        lifecycle: "Repairable",
        imageUrl: "https://img.com/x.jpg",
        brandName: "Brand",
      })

      expect(result["@type"]).toEqual(["Product"])
      expect(result.name).toBe("Scarf")
      expect(result.description).toBe("Story")
      expect(result.productOrigin).toBe("France")
      expect(result.image).toBe("https://img.com/x.jpg")
      expect(result.brand).toEqual({ "@type": "Brand", name: "Brand" })
      expect(result.lifecycle).toBe("Repairable")
    })

    it("parses materials and distributes percentages", () => {
      const result = buildProductJsonLd({
        name: "X",
        story: null,
        materials: "Wool, Cotton, Silk",
        origin: null,
        lifecycle: null,
        imageUrl: null,
        brandName: null,
      })
      expect(result.materialComposition.length).toBe(3)
      const total = result.materialComposition.reduce((s, e) => s + e.percentage, 0)
      expect(total).toBe(100)
    })

    it("adjusts first material when total != 100", () => {
      const result = buildProductJsonLd({
        name: "X",
        story: null,
        materials: "A, B, C, D, E",
        origin: null,
        lifecycle: null,
        imageUrl: null,
        brandName: null,
      })
      const total = result.materialComposition.reduce((s, e) => s + e.percentage, 0)
      expect(total).toBe(100)
    })

    it("returns empty materialComposition for empty materials", () => {
      const result = buildProductJsonLd({
        name: "X",
        story: null,
        materials: "",
        origin: null,
        lifecycle: null,
        imageUrl: null,
        brandName: null,
      })
      expect(result.materialComposition).toEqual([])
    })
  })

  describe("buildManifest", () => {
    it("builds manifest with batch data", () => {
      const result = buildManifest(baseBatchData)

      expect(result["@context"]).toBe("https://schema.org")
      expect(result["@type"]).toBe("DataExport")
      expect(result.brandIdentity.name).toBe("Artisan Co")
      expect(result.brandIdentity.id).toBe("brand-1")
      expect(result.batchId).toBe("batch-1")
      expect(result.batchName).toBe("Run 2024")
      expect(result.productName).toBe("Handcrafted Scarf")
      expect(result.itemCount).toBe(1)
      expect(result.standard).toBe("EU ESPR 2026 Digital Product Passport")
      expect(result.format).toBe("JSON-LD")
    })

    it("uses fallbacks for null batch/product names", () => {
      const data = {
        ...baseBatchData,
        batch: { ...baseBatchData.batch, production_run_name: null },
        brand: { ...baseBatchData.brand, brand_name: null },
      }
      const result = buildManifest(data)
      expect(result.brandIdentity.name).toBe("Unknown Brand")
      expect(result.batchName).toBe("Production Batch")
    })

    it("accepts custom export date", () => {
      const date = new Date("2024-06-15T12:00:00Z")
      const result = buildManifest(baseBatchData, date)
      expect(result.exportDate).toBe("2024-06-15T12:00:00.000Z")
    })
  })
})
