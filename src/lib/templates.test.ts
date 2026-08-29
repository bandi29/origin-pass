import { describe, expect, it } from "vitest"
import {
  emptyCustomFieldsFromTemplate,
  getIndustryTemplate,
  INDUSTRY_TEMPLATE_IDS,
  INDUSTRY_TEMPLATE_LIST,
  INDUSTRY_TEMPLATES,
} from "./templates"
import {
  euResponsiblePersonSchema,
  gpsrSchema,
  materialRowSchema,
  passportUpsertBodySchema,
  timelineRowSchema,
} from "./passport-wizard-schemas"

const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000"

describe("industry templates (unit)", () => {
  it("registers apparel, artisan, and jewelry templates", () => {
    expect([...INDUSTRY_TEMPLATE_IDS]).toEqual([
      "apparel_textiles",
      "artisan_handmade",
      "jewelry_metals",
    ])
    expect(INDUSTRY_TEMPLATE_LIST).toHaveLength(3)
  })

  it("apparel template returns Zod-validated schema structure (fiber + care fields)", () => {
    const tpl = getIndustryTemplate("apparel_textiles")
    expect(tpl).not.toBeNull()
    if (!tpl) return

    expect(tpl.customFields.map((f) => f.key)).toEqual([
      "fiber_composition",
      "weaving_country",
      "dyeing_certifications",
      "washing_care",
    ])
    expect(tpl.customFields.some((f) => /care|washing/i.test(f.label))).toBe(true)

    // Story / materials / timeline must satisfy passport upsert Zod shapes.
    for (const row of tpl.materials) {
      expect(materialRowSchema.safeParse(row).success).toBe(true)
    }
    for (const row of tpl.timeline) {
      expect(timelineRowSchema.safeParse(row).success).toBe(true)
    }

    const upsert = passportUpsertBodySchema.safeParse({
      productId: PRODUCT_ID,
      industryTemplateId: tpl.id,
      story: tpl.story,
      materials: tpl.materials,
      timeline: tpl.timeline,
      customFields: emptyCustomFieldsFromTemplate(tpl),
    })
    expect(upsert.success).toBe(true)
  })

  it("artisan template includes provenance and technique fields", () => {
    const keys = INDUSTRY_TEMPLATES.artisan_handmade.customFields.map((f) => f.key)
    expect(keys).toContain("artisan_name")
    expect(keys).toContain("material_provenance")
    expect(keys).toContain("handcrafting_technique")
    expect(keys).toContain("care_instructions")
  })

  it("jewelry template includes purity, gemstone sourcing, recycled %", () => {
    const keys = INDUSTRY_TEMPLATES.jewelry_metals.customFields.map((f) => f.key)
    expect(keys).toEqual(["metal_purity", "gemstone_sourcing", "recycled_content_pct"])
  })

  it("getIndustryTemplate returns null for unknown ids", () => {
    expect(getIndustryTemplate(null)).toBeNull()
    expect(getIndustryTemplate("unknown")).toBeNull()
    expect(getIndustryTemplate("apparel_textiles")?.id).toBe("apparel_textiles")
  })

  it("emptyCustomFieldsFromTemplate seeds editable empty strings", () => {
    const map = emptyCustomFieldsFromTemplate(INDUSTRY_TEMPLATES.apparel_textiles)
    expect(map).toEqual({
      fiber_composition: "",
      weaving_country: "",
      dyeing_certifications: "",
      washing_care: "",
    })
  })
})

describe("GPSR Zod validation", () => {
  it("accepts a valid EU responsible person email and address", () => {
    const person = euResponsiblePersonSchema.safeParse({
      name: "Ada Lovelace",
      company: "EU RP GmbH",
      email: "rp@example.com",
      address: "Friedrichstraße 1, 10117 Berlin, DE",
      phone: "+49 30 123456",
    })
    expect(person.success).toBe(true)

    const full = gpsrSchema.safeParse({
      euResponsiblePerson: person.success ? person.data : {},
      safetyInformation: ["Keep away from open flame"],
      productIdentifiers: {
        gtin: "00810012345675",
        hsCode: "6109.10",
        batchNumber: "LOT-42",
      },
    })
    expect(full.success).toBe(true)
  })

  it("allows empty email while drafting", () => {
    expect(euResponsiblePersonSchema.safeParse({ email: "" }).success).toBe(true)
  })

  it("rejects malformed EU responsible person email", () => {
    const bad = euResponsiblePersonSchema.safeParse({
      name: "Ada",
      email: "not-an-email",
      address: "Berlin",
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.path.includes("email"))).toBe(true)
    }
  })

  it("rejects malformed EU responsible person objects (wrong types)", () => {
    const bad = gpsrSchema.safeParse({
      euResponsiblePerson: {
        name: 123,
        company: true,
        email: ["rp@example.com"],
      },
      safetyInformation: "not-an-array",
    })
    expect(bad.success).toBe(false)
  })

  it("rejects oversized safety warning lists", () => {
    const r = gpsrSchema.safeParse({
      safetyInformation: Array.from({ length: 21 }, (_, i) => `warn ${i}`),
    })
    expect(r.success).toBe(false)
  })

  it("embeds GPSR into passport upsert body when valid", () => {
    const r = passportUpsertBodySchema.safeParse({
      productId: PRODUCT_ID,
      industryTemplateId: "apparel_textiles",
      customFields: { fiber_composition: "100% cotton", washing_care: "Cold wash" },
      gpsr: {
        euResponsiblePerson: {
          name: "Ada",
          company: "RP Co",
          email: "ada@rp.eu",
          address: "Lisbon, PT",
          phone: "",
        },
        safetyInformation: ["Handle with care"],
        productIdentifiers: { gtin: "", hsCode: "", batchNumber: "" },
      },
    })
    expect(r.success).toBe(true)
  })
})
