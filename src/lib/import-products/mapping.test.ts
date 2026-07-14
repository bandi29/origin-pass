import { describe, expect, it } from "vitest"
import { guessMapping, synonymMatchesNormalizedHeader } from "./mapping"

describe("import mapping", () => {
  it("synonymMatchesNormalizedHeader rejects short substring noise (column1 vs co)", () => {
    expect(synonymMatchesNormalizedHeader("co", "column1")).toBe(false)
    expect(synonymMatchesNormalizedHeader("country", "column1")).toBe(false)
    expect(synonymMatchesNormalizedHeader("country", "origin_country")).toBe(true)
    expect(synonymMatchesNormalizedHeader("country", "country_of_origin")).toBe(true)
  })

  it("guessMapping does not assign Column 1 to origin_country", () => {
    const headers = [
      "product_name",
      "sku",
      "category",
      "brand_url",
      "Column 1",
      "material_origin",
    ]
    const m = guessMapping(headers)
    expect(m.origin_country).not.toBe("Column 1")
    expect(m.product_name).toBe("product_name")
    expect(m.product_id).toBe("sku")
  })
})
