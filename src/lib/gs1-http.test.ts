import { afterEach, describe, expect, it, vi } from "vitest"
import {
  GS1_INVALID_STRUCTURE_MESSAGE,
  GS1_NOT_FOUND_MESSAGE,
  classifyGs1DigitalLinkRequest,
  isMalformedGtinIdentifier,
  publicPassportTargetPath,
  wantsGs1MachinePayload,
} from "./gs1-http"
import type { Gs1ResolvedProduct } from "./gs1-passport-resolve"

const resolveMock = vi.fn()

vi.mock("./gs1-passport-resolve", async () => {
  const actual = await vi.importActual<typeof import("./gs1-passport-resolve")>("./gs1-passport-resolve")
  return {
    ...actual,
    resolveGs1DigitalLinkPath: (...args: unknown[]) => resolveMock(...args),
  }
})

describe("gs1-http scenario helpers", () => {
  afterEach(() => {
    resolveMock.mockReset()
  })

  describe("GS1-03 content negotiation", () => {
    it("treats application/ld+json and application/json as machine payloads", () => {
      expect(wantsGs1MachinePayload("application/ld+json")).toBe(true)
      expect(wantsGs1MachinePayload("application/json")).toBe(true)
      expect(wantsGs1MachinePayload("text/html,application/xhtml+xml")).toBe(false)
      expect(wantsGs1MachinePayload(null)).toBe(false)
    })
  })

  describe("GS1-04 malformed GTIN", () => {
    it("flags non-numeric, wrong length, and bad check digits", () => {
      expect(isMalformedGtinIdentifier("abcdefghijklm")).toBe(true)
      expect(isMalformedGtinIdentifier("1234567890")).toBe(true) // 10 digits
      expect(isMalformedGtinIdentifier("5901234123458")).toBe(true) // bad check
      expect(isMalformedGtinIdentifier("5901234123457")).toBe(false)
    })

    it("does not treat product UUID as malformed GTIN (hybrid fallback)", () => {
      expect(isMalformedGtinIdentifier("550e8400-e29b-41d4-a716-446655440000")).toBe(false)
    })
  })

  describe("classifyGs1DigitalLinkRequest", () => {
    it("GS1-04: returns invalid_structure for 10-digit GTIN without DB lookup success path", async () => {
      const result = await classifyGs1DigitalLinkRequest(["1234567890"])
      expect(result.kind).toBe("invalid_structure")
      if (result.kind === "invalid_structure") {
        expect(result.message).toBe(GS1_INVALID_STRUCTURE_MESSAGE)
      }
      expect(resolveMock).not.toHaveBeenCalled()
    })

    it("GS1-05: valid unassigned GTIN ? not_found", async () => {
      resolveMock.mockResolvedValueOnce(null)
      const result = await classifyGs1DigitalLinkRequest(["5901234123457"])
      expect(result.kind).toBe("not_found")
      if (result.kind === "not_found") {
        expect(result.message).toBe(GS1_NOT_FOUND_MESSAGE)
      }
      expect(resolveMock).toHaveBeenCalled()
    })

    it("GS1-01 / GS1-02: resolved product keeps lot + serial from path", async () => {
      const product: Gs1ResolvedProduct = {
        productId: "550e8400-e29b-41d4-a716-446655440000",
        externalProductId: "999",
        externalVariantId: null,
        shopDomain: "demo.myshopify.com",
        shopSlug: "demo",
        name: "Coat",
        gtin: "5901234123457",
        gln: null,
        defaultLotNumber: null,
        materials: "Wool",
        originCountry: "PT",
        productionLocation: "PT",
        certificates: [],
        lot: "BATCH-9",
        serial: "SER-42",
        passportToken: "OP-1",
        matchedBy: "product_gtin",
      }
      resolveMock.mockResolvedValueOnce(product)

      const result = await classifyGs1DigitalLinkRequest([
        "5901234123457",
        "10",
        "BATCH-9",
        "21",
        "SER-42",
      ])
      expect(result.kind).toBe("ok")
      if (result.kind === "ok") {
        expect(result.product.lot).toBe("BATCH-9")
        expect(result.product.serial).toBe("SER-42")
        expect(publicPassportTargetPath(result.product)).toBe("/sp/demo/999")
      }
    })
  })
})
