import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isShopifyIframeBlockedPath,
  openOutsideShopifyEmbed,
  shopifyEmbeddedHomeHref,
  shopifyEmbeddedQueryString,
} from "./shopify-embedded-url"

describe("shopifyEmbeddedQueryString", () => {
  it("always includes embedded=1 when shop and host are present", () => {
    const qs = shopifyEmbeddedQueryString({
      shop: "originpass-sandbox.myshopify.com",
      host: "abc",
    })
    expect(qs).toContain("embedded=1")
    expect(qs).toContain("shop=originpass-sandbox.myshopify.com")
    expect(qs).toContain("host=abc")
  })
})

describe("shopifyEmbeddedHomeHref", () => {
  it("uses / with embed params for iframe navigation", () => {
    const href = shopifyEmbeddedHomeHref({
      embedded: "1",
      shop: "originpass-sandbox.myshopify.com",
      host: "abc",
    })
    expect(href.startsWith("/?")).toBe(true)
    expect(href).toContain("embedded=1")
    expect(href).toContain("shop=originpass-sandbox.myshopify.com")
    expect(href).toContain("host=abc")
  })
})

describe("isShopifyIframeBlockedPath", () => {
  it("flags public passport and scan paths that send SAMEORIGIN", () => {
    expect(isShopifyIframeBlockedPath("/sp/shop/123")).toBe(true)
    expect(isShopifyIframeBlockedPath("https://origin-pass.vercel.app/shop/x/y")).toBe(true)
    expect(isShopifyIframeBlockedPath("/p/abc")).toBe(true)
    expect(isShopifyIframeBlockedPath("/s/uuid")).toBe(true)
    expect(isShopifyIframeBlockedPath("/scan/1")).toBe(true)
  })

  it("allows embedded admin paths", () => {
    expect(isShopifyIframeBlockedPath("/api/shopify")).toBe(false)
    expect(isShopifyIframeBlockedPath("/products/1")).toBe(false)
    expect(isShopifyIframeBlockedPath("/?shop=x")).toBe(false)
  })
})

describe("openOutsideShopifyEmbed", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("opens blank mode in a new tab", () => {
    const open = vi.fn(() => ({ focus() {} }))
    vi.stubGlobal("window", { open, shopify: undefined })
    expect(openOutsideShopifyEmbed("https://example.com/sp/a/b", "blank")).toBe(true)
    expect(open).toHaveBeenCalledWith("https://example.com/sp/a/b", "_blank", "noopener,noreferrer")
  })

  it("falls back to _top when the popup is blocked", () => {
    const open = vi.fn(() => null)
    vi.stubGlobal("window", { open, shopify: undefined })
    expect(openOutsideShopifyEmbed("https://example.com/sp/a/b", "blank")).toBe(true)
    expect(open).toHaveBeenLastCalledWith("https://example.com/sp/a/b", "_top")
  })

  it("uses top-level navigation for OAuth/billing mode", () => {
    const open = vi.fn(() => null)
    const top = { location: { href: "" } }
    vi.stubGlobal("window", { open, top, shopify: undefined })
    expect(openOutsideShopifyEmbed("https://shop.myshopify.com/admin/oauth/authorize", "top")).toBe(true)
    expect(top.location.href).toContain("/admin/oauth/authorize")
  })
})
