import { describe, expect, it } from "vitest"
import { getFirstMissingRequiredFieldKeyForHighlight } from "./validate-category-product"

describe("getFirstMissingRequiredFieldKeyForHighlight", () => {
  it("authenticity: skips non-required certification fields then returns first required traceability gap (leather)", () => {
    const key = getFirstMissingRequiredFieldKeyForHighlight("leather", {}, "authenticity")
    expect(key).toBe("origin_country")
  })

  it("compliance: returns first required field in compliance section (leather)", () => {
    const key = getFirstMissingRequiredFieldKeyForHighlight("leather", {}, "compliance")
    expect(key).toBe("eudr_dds_reference")
  })

  it("returns null when highlight is unknown", () => {
    expect(getFirstMissingRequiredFieldKeyForHighlight("leather", {}, "other")).toBeNull()
  })

  it("returns null when category is empty", () => {
    expect(getFirstMissingRequiredFieldKeyForHighlight("", {}, "compliance")).toBeNull()
  })

  it("returns null when all required fields in scope are filled (leather compliance)", () => {
    const data = {
      eudr_dds_reference: "DDS-1",
      raw_hide_origin_country: "Italy",
      tanning_site_country: "Italy",
      chemical_compliance_summary: "REACH ok",
    }
    expect(getFirstMissingRequiredFieldKeyForHighlight("leather", data, "compliance")).toBeNull()
  })
})
