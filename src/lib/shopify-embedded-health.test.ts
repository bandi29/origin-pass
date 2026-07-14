import { describe, expect, it } from "vitest"
import {
  EMBEDDED_HOME_MARKERS,
  EMBEDDED_PRODUCT_EDITOR_MARKERS,
  canImportEmbeddedHome,
  isShopifyEmbeddedEntryQuery,
  validateEmbeddedPageShell,
} from "./shopify-embedded-health"

describe("isShopifyEmbeddedEntryQuery", () => {
  const params = (input: Record<string, string>) => ({
    get(name: string) {
      return input[name] ?? null
    },
  })

  it("accepts embedded=1 with a valid shop", () => {
    expect(
      isShopifyEmbeddedEntryQuery(
        params({ embedded: "1", shop: "originpass-sandbox.myshopify.com" }),
      ),
    ).toBe(true)
  })

  it("accepts shop+host without embedded=1 (Shopify iframe links)", () => {
    expect(
      isShopifyEmbeddedEntryQuery(
        params({
          shop: "originpass-sandbox.myshopify.com",
          host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvb3JpZ2lucGFzcy1zYW5kYm94",
        }),
      ),
    ).toBe(true)
  })

  it("rejects bare / requests that would fall through to next-intl", () => {
    expect(isShopifyEmbeddedEntryQuery(params({}))).toBe(false)
    expect(isShopifyEmbeddedEntryQuery(params({ shop: "originpass-sandbox.myshopify.com" }))).toBe(false)
  })
})

describe("validateEmbeddedPageShell", () => {
  it("passes when home markers are present", () => {
    const html = EMBEDDED_HOME_MARKERS.join(" · ")
    expect(validateEmbeddedPageShell(html, "home")).toEqual([])
  })

  it("reports missing home markers", () => {
    expect(validateEmbeddedPageShell("<html>empty</html>", "home")).toEqual([
      "Store configuration",
      "Brand defaults",
      "Hook active",
    ])
  })

  it("passes when product editor markers are present", () => {
    const html = EMBEDDED_PRODUCT_EDITOR_MARKERS.join(" · ")
    expect(validateEmbeddedPageShell(html, "product-editor")).toEqual([])
  })
})

describe("canImportEmbeddedHome", () => {
  it("accepts a default export function", async () => {
    const mod = await import("@/app/(shopify-embedded)/api/shopify/app-home/page")
    expect(canImportEmbeddedHome(mod)).toBe(true)
  })

  it("rejects modules without a default export", () => {
    expect(canImportEmbeddedHome({})).toBe(false)
  })
})

describe("shopify-catalog-sync-progress", () => {
  it("imports under Turbopack-safe global store typing", async () => {
    const mod = await import("./shopify-catalog-sync-progress")
    expect(typeof mod.getShopifySyncProgressState).toBe("function")
    expect(mod.getShopifySyncProgressState("turbopack-safe.myshopify.com").status).toBe("idle")
  })
})
