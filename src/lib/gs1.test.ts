import { describe, expect, it } from "vitest"
import {
  buildGS1DigitalLink,
  computeGtinCheckDigit,
  gtinFormatLabel,
  padGTIN,
  parseGS1DigitalLinkPath,
  resolvePassportLinkUrl,
  validateGTIN,
} from "./gs1"

describe("gs1", () => {
  describe("validateGTIN", () => {
    it("accepts well-known valid GTINs", () => {
      // GTIN-13 (EAN-13): 5901234123457
      expect(validateGTIN("5901234123457")).toBe(true)
      // GTIN-14 padded form of same
      expect(validateGTIN("05901234123457")).toBe(true)
      // UPC-A (12): 036000291452
      expect(validateGTIN("036000291452")).toBe(true)
    })

    it("rejects wrong check digits and lengths", () => {
      expect(validateGTIN("5901234123458")).toBe(false)
      expect(validateGTIN("123")).toBe(false)
      expect(validateGTIN("")).toBe(false)
      expect(validateGTIN("abcdefghijklm")).toBe(false)
    })

    it("strips non-digits before validating", () => {
      expect(validateGTIN("590-1234-1234-57")).toBe(true)
    })
  })

  describe("padGTIN", () => {
    it("left-pads to 14 digits", () => {
      expect(padGTIN("036000291452")).toBe("00036000291452")
      expect(padGTIN("5901234123457")).toBe("05901234123457")
      expect(padGTIN("05901234123457")).toBe("05901234123457")
    })

    it("returns empty for empty input", () => {
      expect(padGTIN("")).toBe("")
    })
  })

  describe("buildGS1DigitalLink", () => {
    it("builds /01 path with optional lot and serial", () => {
      expect(buildGS1DigitalLink("origin-pass.vercel.app", "5901234123457")).toBe(
        "https://origin-pass.vercel.app/01/05901234123457",
      )
      expect(
        buildGS1DigitalLink("origin-pass.vercel.app", "5901234123457", "LOT-A", "SER-1"),
      ).toBe("https://origin-pass.vercel.app/01/05901234123457/10/LOT-A/21/SER-1")
    })

    it("accepts domain with protocol", () => {
      expect(buildGS1DigitalLink("https://example.com/", "5901234123457")).toBe(
        "https://example.com/01/05901234123457",
      )
    })
  })

  describe("parseGS1DigitalLinkPath", () => {
    it("extracts AI 01/10/21", () => {
      expect(parseGS1DigitalLinkPath(["01", "05901234123457", "10", "LOT1", "21", "S1"])).toEqual({
        gtin: "05901234123457",
        lot: "LOT1",
        serial: "S1",
      })
    })

    it("accepts path without leading 01 token when catch-all starts at gtin", () => {
      expect(parseGS1DigitalLinkPath(["05901234123457", "10", "L1"])).toEqual({
        gtin: "05901234123457",
        lot: "L1",
        serial: undefined,
      })
    })
  })

  describe("resolvePassportLinkUrl", () => {
    it("uses GS1 when GTIN valid", () => {
      const result = resolvePassportLinkUrl({
        domain: "example.com",
        gtin: "5901234123457",
        fallbackUrl: "https://example.com/sp/shop/123",
      })
      expect(result.linkType).toBe("gs1")
      expect(result.url).toContain("/01/")
    })

    it("falls back when GTIN missing or invalid - existing products unchanged", () => {
      expect(
        resolvePassportLinkUrl({
          domain: "example.com",
          gtin: null,
          fallbackUrl: "https://example.com/sp/shop/123",
        }),
      ).toEqual({ url: "https://example.com/sp/shop/123", linkType: "standard" })

      expect(
        resolvePassportLinkUrl({
          domain: "example.com",
          gtin: "not-a-gtin",
          fallbackUrl: "https://example.com/p/abc",
        }),
      ).toEqual({ url: "https://example.com/p/abc", linkType: "standard" })
    })
  })

  describe("helpers", () => {
    it("computeGtinCheckDigit and gtinFormatLabel", () => {
      expect(computeGtinCheckDigit("590123412345")).toBe(7)
      expect(gtinFormatLabel("5901234123457")).toBe("GTIN-13")
      expect(gtinFormatLabel("bad")).toBeNull()
    })
  })
})
