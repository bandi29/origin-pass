import { describe, expect, it, vi } from "vitest"
import {
  buildProductResolveQuery,
  certificationWizardHref,
  certificationWizardHrefFromHints,
  pickProductIdForCertificationAlert,
  printStudioHref,
  productResolveApiUrl,
  resolveCertificationProductIdFromHints,
  resolveExportReadyStudioHref,
} from "./dashboard-notification-routing"

describe("dashboard-notification-routing", () => {
  describe("printStudioHref / resolveExportReadyStudioHref", () => {
    it("builds Label Studio URLs with batch, product, or search", () => {
      expect(printStudioHref({ batchId: "b1" })).toContain("batchId=b1")
      expect(printStudioHref({ productId: "p9" })).toContain("productId=p9")
      expect(printStudioHref({ printSearch: "Linen" })).toContain("printSearch=Linen")
      expect(printStudioHref({})).toBe("/dashboard/qr-identity/print")
    })

    it("export-ready resolver prefers explicit ids over search and fallback", () => {
      expect(
        resolveExportReadyStudioHref(
          { productId: "a", printSearch: "x", batchId: "b" },
          { fallbackProductId: "fb" },
        ),
      ).toContain("productId=a")
      expect(resolveExportReadyStudioHref({ batchId: "bb" }, { fallbackProductId: "fb" })).toContain("batchId=bb")
      expect(resolveExportReadyStudioHref({ printSearch: "Linen" }, { fallbackProductId: "fb" })).toContain(
        "printSearch=Linen",
      )
      expect(resolveExportReadyStudioHref({}, { fallbackProductId: "fb" })).toContain("productId=fb")
      expect(resolveExportReadyStudioHref({}, {})).toBe("/dashboard/qr-identity/print")
    })
  })

  describe("certificationWizardHref", () => {
    it("includes compliance deep-link params and optional productId", () => {
      const href = certificationWizardHref("abc-uuid")
      expect(href).toContain("/dashboard/products/passport-wizard?")
      expect(href).toContain("step=compliance")
      expect(href).toContain("highlight=authenticity")
      expect(href).toContain("flow=compliance")
      expect(href).toContain("productId=abc-uuid")
    })

    it("omits productId when null or blank", () => {
      expect(certificationWizardHref(null)).not.toContain("productId")
      expect(certificationWizardHref(undefined)).not.toContain("productId")
      expect(certificationWizardHref("  ")).not.toContain("productId")
    })
  })

  describe("certificationWizardHrefFromHints", () => {
    it("adds certSku and certName for wizard-side resolve (not the generic Products hub)", () => {
      const href = certificationWizardHrefFromHints({ certSku: "SKU-302", certName: "Leather Tote Bag" })
      expect(href).toContain("/dashboard/products/passport-wizard?")
      expect(href).toContain("certSku=")
      expect(href).toContain("certName=")
      expect(href).not.toContain("productId=")
    })
  })

  describe("resolveCertificationProductIdFromHints", () => {
    it("returns id from /api/products/resolve when present", async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.startsWith("/api/products/resolve")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ productId: "uuid-1" }),
          })
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      })
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)
      await expect(
        resolveCertificationProductIdFromHints({ sku: "SKU-302", productName: "X" }),
      ).resolves.toBe("uuid-1")
      vi.unstubAllGlobals()
    })

    it("falls back to /api/products/mine + pick when resolve has no id", async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.startsWith("/api/products/resolve")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ productId: null }),
          })
        }
        if (url.startsWith("/api/products/mine")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                products: [{ id: "p-b", name: "Leather Tote Bag", sku: "SKU-302" }],
              }),
          })
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      })
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)
      await expect(
        resolveCertificationProductIdFromHints({ sku: "SKU-302", productName: "Leather Tote Bag" }),
      ).resolves.toBe("p-b")
      vi.unstubAllGlobals()
    })

    it("returns null when both resolve and mine miss", async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.startsWith("/api/products/resolve")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ productId: null }),
          })
        }
        if (url.startsWith("/api/products/mine")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ products: [] }),
          })
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
      })
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)
      await expect(resolveCertificationProductIdFromHints({ sku: "nope" })).resolves.toBeNull()
      vi.unstubAllGlobals()
    })
  })

  describe("buildProductResolveQuery", () => {
    it("builds sku and name params", () => {
      expect(buildProductResolveQuery({ sku: "SKU-302", name: "Leather Tote Bag" })).toBe(
        "sku=SKU-302&name=Leather+Tote+Bag",
      )
    })

    it("skips empty strings", () => {
      expect(buildProductResolveQuery({ sku: "", name: "X" })).toBe("name=X")
      expect(buildProductResolveQuery({ sku: "  ", name: undefined })).toBe("")
    })
  })

  describe("productResolveApiUrl", () => {
    it("prefixes the resolve API path", () => {
      expect(productResolveApiUrl("sku=a")).toBe("/api/products/resolve?sku=a")
      expect(productResolveApiUrl("")).toBe("/api/products/resolve")
    })
  })

  describe("pickProductIdForCertificationAlert", () => {
    const rows = [
      { id: "a", name: "Linen Tote Bag", sku: "SKU-100" },
      { id: "b", name: "Leather Tote Bag", sku: "SKU-302" },
      { id: "c", name: "Other", sku: null },
    ]

    it("matches unique sku", () => {
      expect(pickProductIdForCertificationAlert(rows, { sku: "SKU-302" })).toBe("b")
    })

    it("matches sku when DB stores unprefixed code and notification uses SKU- prefix", () => {
      const r = [
        { id: "a", name: "Leather Tote Bag", sku: "302" },
        { id: "b", name: "Other", sku: "100" },
      ]
      expect(pickProductIdForCertificationAlert(r, { sku: "SKU-302" })).toBe("a")
    })

    it("matches single full / partial name", () => {
      expect(pickProductIdForCertificationAlert(rows, { productName: "Leather Tote Bag" })).toBe("b")
      expect(pickProductIdForCertificationAlert(rows, { productName: "leather tote" })).toBe("b")
    })

    it("matches when all significant name words appear", () => {
      expect(pickProductIdForCertificationAlert(rows, { productName: "Linen Tote" })).toBe("a")
    })

    it("returns null when ambiguous or missing", () => {
      expect(pickProductIdForCertificationAlert(rows, { productName: "Tote" })).toBeNull()
      expect(pickProductIdForCertificationAlert(rows, { sku: "nope" })).toBeNull()
    })
  })
})
