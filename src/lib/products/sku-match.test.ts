import { describe, expect, it } from "vitest"
import { normalizeSkuHint, skuExactIlikeCandidates } from "./sku-match"

describe("sku-match", () => {
  it("normalizeSkuHint strips common SKU prefixes", () => {
    expect(normalizeSkuHint("SKU-302")).toBe("302")
    expect(normalizeSkuHint("sku 302")).toBe("302")
    expect(normalizeSkuHint("#302")).toBe("302")
    expect(normalizeSkuHint("  302  ")).toBe("302")
  })

  it("skuExactIlikeCandidates includes raw and normalized forms", () => {
    expect(skuExactIlikeCandidates("SKU-302")).toEqual(["SKU-302", "302"])
    expect(skuExactIlikeCandidates("302")).toEqual(["302"])
  })
})
