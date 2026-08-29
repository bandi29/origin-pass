import { describe, expect, it } from "vitest"
import {
  createProductBodySchema,
  EMPTY_GPSR,
  gpsrSchema,
  patchProductBodySchema,
  passportUpsertBodySchema,
  qrcodeBodySchema,
} from "./passport-wizard-schemas"

describe("createProductBodySchema", () => {
  it("requires name min length 3", () => {
    expect(createProductBodySchema.safeParse({ name: "ab" }).success).toBe(false)
    expect(createProductBodySchema.safeParse({ name: "abc" }).success).toBe(true)
  })
})

describe("gpsrSchema", () => {
  it("accepts EMPTY_GPSR defaults", () => {
    const r = gpsrSchema.safeParse(EMPTY_GPSR)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.euResponsiblePerson?.name).toBe("")
      expect(r.data.safetyInformation).toEqual([])
      expect(r.data.productIdentifiers?.gtin).toBe("")
    }
  })

  it("accepts EU responsible person + safety warnings + identifiers", () => {
    const r = gpsrSchema.safeParse({
      euResponsiblePerson: {
        name: "Ada Lovelace",
        company: "EU RP GmbH",
        email: "rp@example.com",
        address: "Berlin, DE",
        phone: "+49 30 123",
      },
      safetyInformation: ["Keep away from open flame", "Not for children under 3"],
      productIdentifiers: {
        gtin: "00810012345675",
        hsCode: "6109.10",
        batchNumber: "LOT-42",
      },
    })
    expect(r.success).toBe(true)
  })

  it("rejects oversized safety warning arrays", () => {
    const r = gpsrSchema.safeParse({
      safetyInformation: Array.from({ length: 21 }, (_, i) => `warn ${i}`),
    })
    expect(r.success).toBe(false)
  })
})

describe("passportUpsertBodySchema", () => {
  it("accepts valid product id and optional arrays", () => {
    const r = passportUpsertBodySchema.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      story: "Hello",
      materials: [{ name: "Cotton" }],
      timeline: [],
    })
    expect(r.success).toBe(true)
  })

  it("accepts industry template, custom fields, and GPSR payload", () => {
    const r = passportUpsertBodySchema.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      industryTemplateId: "apparel_textiles",
      customFields: { fiber_composition: "100% cotton", washing_care: "Cold wash" },
      gpsr: {
        euResponsiblePerson: { company: "RP Co", name: "", email: "", address: "", phone: "" },
        safetyInformation: ["Handle with care"],
        productIdentifiers: { gtin: "", hsCode: "", batchNumber: "" },
      },
    })
    expect(r.success).toBe(true)
  })

  it("rejects unknown industryTemplateId", () => {
    const r = passportUpsertBodySchema.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      industryTemplateId: "automotive",
    })
    expect(r.success).toBe(false)
  })
})

describe("qrcodeBodySchema", () => {
  it("requires uuid passportId", () => {
    expect(qrcodeBodySchema.safeParse({ passportId: "not-a-uuid" }).success).toBe(false)
    expect(
      qrcodeBodySchema.safeParse({ passportId: "550e8400-e29b-41d4-a716-446655440000" }).success,
    ).toBe(true)
  })

  it("accepts quantity with bounds", () => {
    expect(
      qrcodeBodySchema.safeParse({
        passportId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 25,
      }).success,
    ).toBe(true)
    expect(
      qrcodeBodySchema.safeParse({
        passportId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 0,
      }).success,
    ).toBe(false)
  })
})

describe("patchProductBodySchema", () => {
  it("accepts complianceCategoryKey alone", () => {
    const r = patchProductBodySchema.safeParse({ complianceCategoryKey: "leather" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.complianceCategoryKey).toBe("leather")
  })

  it("rejects invalid complianceCategoryKey", () => {
    expect(patchProductBodySchema.safeParse({ complianceCategoryKey: "invalid" }).success).toBe(
      false,
    )
  })
})
