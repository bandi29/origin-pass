import { describe, expect, it } from "vitest"
import { gtinLookupCandidates, buildGs1JsonLd } from "./gs1-passport-resolve"
import type { Gs1ResolvedProduct } from "./gs1-passport-resolve"

describe("gs1-passport-resolve", () => {
  it("builds padded and unpadded GTIN lookup candidates", () => {
    const candidates = gtinLookupCandidates("5901234123457")
    expect(candidates).toContain("5901234123457")
    expect(candidates).toContain("05901234123457")
  })

  it("matches zero-padding equivalents of the SAME value (UPC-A / EAN-13 / GTIN-14)", () => {
    // 12-digit value stored under any GS1 length must all resolve to each other.
    const candidates = gtinLookupCandidates("123456789012")
    expect(candidates).toContain("123456789012") // UPC-A
    expect(candidates).toContain("0123456789012") // EAN-13
    expect(candidates).toContain("00123456789012") // GTIN-14
  })

  it("never emits significant-digit truncations (no cross-product false match)", () => {
    // GTIN-14 with NO leading zeros: candidates must not include 12/13-digit
    // truncations, which would belong to a DIFFERENT product.
    const candidates = gtinLookupCandidates("95012341234573")
    expect(candidates).toContain("95012341234573")
    for (const c of candidates) {
      // Every candidate is the same numeric value, just zero-padded — never shorter
      // than the significant digits.
      expect(c.replace(/^0+/, "")).toBe("95012341234573")
    }
  })

  it("builds GS1 JSON-LD payload shape", () => {
    const product: Gs1ResolvedProduct = {
      productId: "550e8400-e29b-41d4-a716-446655440000",
      externalProductId: "123",
      externalVariantId: null,
      shopDomain: "demo.myshopify.com",
      shopSlug: "demo",
      name: "Wool Coat",
      gtin: "5901234123457",
      gln: null,
      defaultLotNumber: "LOT-1",
      materials: "100% Wool",
      originCountry: "Portugal",
      productionLocation: "Portugal",
      certificates: [{ name: "GOTS", fieldKey: "materials" }],
      passportToken: "OP-ABC",
      matchedBy: "product_gtin",
    }
    const json = buildGs1JsonLd(product, "https://example.com/01/05901234123457")
    expect(json["@context"]).toBe("https://gs1.org/voc/")
    expect(json.gtin).toBe("05901234123457")
    expect(json.countryOfOrigin).toBe("Portugal")
    expect(json.materials).toBe("100% Wool")
    expect(json.certificates).toEqual(["GOTS"])
  })
})
