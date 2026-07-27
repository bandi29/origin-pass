import { afterEach, describe, expect, it, vi } from "vitest"
import {
  isShopifyIframeBlockedPath,
  openOutsideShopifyEmbed,
  resolveShopifyPublicOpenUrl,
  shopifyEmbeddedHomeHref,
  shopifyEmbeddedQueryString,
} from "./shopify-embedded-url"

describe("resolveShopifyPublicOpenUrl", () => {
  it("rewrites localhost public URLs to the Cloudflare tunnel / prod embed origin", () => {
    const out = resolveShopifyPublicOpenUrl(
      "http://localhost:3000/sp/originpass-sandbox/10543685730591?preview=true",
      "https://suspected-mistress-sessions-hills.trycloudflare.com",
    )
    expect(out).toBe(
      "https://suspected-mistress-sessions-hills.trycloudflare.com/sp/originpass-sandbox/10543685730591?preview=true",
    )
  })

  it("leaves non-localhost URLs unchanged", () => {
    const url = "https://origin-pass.vercel.app/sp/originpass-sandbox/1?preview=true"
    expect(resolveShopifyPublicOpenUrl(url, "https://tunnel.example.com")).toBe(url)
  })

  it("keeps localhost when the embed itself is also localhost", () => {
    const url = "http://localhost:3000/sp/demo/1"
    expect(resolveShopifyPublicOpenUrl(url, "http://localhost:3000")).toBe(url)
  })
})

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

describe("absolutizeEmbedUrl / openOutsideShopifyEmbed top", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("absolutizeEmbedUrl anchors relative paths to the iframe origin", async () => {
    const { absolutizeEmbedUrl } = await import("./shopify-embedded-url")
    expect(absolutizeEmbedUrl("/api/shopify/auth?shop=x.myshopify.com", "https://tunnel.trycloudflare.com")).toBe(
      "https://tunnel.trycloudflare.com/api/shopify/auth?shop=x.myshopify.com",
    )
    expect(absolutizeEmbedUrl("https://origin-pass.vercel.app/api/shopify/auth", "https://tunnel.trycloudflare.com")).toBe(
      "https://origin-pass.vercel.app/api/shopify/auth",
    )
  })

  it("top-mode openOutsideShopifyEmbed does not send relative /api paths to admin.shopify.com", () => {
    const open = vi.fn(() => null)
    vi.stubGlobal("window", {
      open,
      shopify: {},
      location: { origin: "https://mineral-butler-resolution-secret.trycloudflare.com" },
      top: { location: { href: "" } },
    })
    openOutsideShopifyEmbed("/api/shopify/auth?shop=originpass-sandbox.myshopify.com", "top")
    expect(open).toHaveBeenCalledWith(
      "https://mineral-butler-resolution-secret.trycloudflare.com/api/shopify/auth?shop=originpass-sandbox.myshopify.com",
      "_top",
    )
  })

  // Chrome returns `null` from window.open even on success. Null must not be read as
  // "blocked" — doing so triggered a second navigation and opened the passport twice.
  it("opens blank mode via window.open, never a synthetic anchor (single navigation)", () => {
    const open = vi.fn(() => null)
    const click = vi.fn()
    const appendChild = vi.fn()
    const createElement = vi.fn(() => ({
      href: "",
      target: "",
      rel: "",
      setAttribute: vi.fn(),
      click,
      remove: vi.fn(),
    }))
    vi.stubGlobal("document", { createElement, body: { appendChild } })
    vi.stubGlobal("window", {
      open,
      shopify: undefined,
      location: { origin: "https://example.com" },
      document: { createElement, body: { appendChild } },
    })

    expect(openOutsideShopifyEmbed("https://example.com/sp/a/b", "blank")).toBe(true)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith("https://example.com/sp/a/b", "_blank", "noopener,noreferrer")
    // App Bridge intercepts anchor clicks inside the Admin iframe and navigates the
    // host too — so the anchor path must not run when window.open succeeded.
    expect(createElement).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
  })

  it("rewrites localhost View-passport URLs to the current tunnel origin", () => {
    const open = vi.fn(() => null)
    vi.stubGlobal("window", {
      open,
      shopify: undefined,
      location: { origin: "https://suspected-mistress-sessions-hills.trycloudflare.com" },
      document: { createElement: vi.fn(), body: { appendChild: vi.fn() } },
    })

    openOutsideShopifyEmbed(
      "http://localhost:3000/sp/originpass-sandbox/10543685730591?preview=true",
      "blank",
    )
    expect(open).toHaveBeenCalledWith(
      "https://suspected-mistress-sessions-hills.trycloudflare.com/sp/originpass-sandbox/10543685730591?preview=true",
      "_blank",
      "noopener,noreferrer",
    )
  })

  it("falls back to an anchor only when window.open throws, and never navigates _top", () => {
    const open = vi.fn(() => {
      throw new Error("popup unavailable")
    })
    const click = vi.fn()
    const appendChild = vi.fn()
    const createElement = vi.fn(() => ({
      href: "",
      target: "",
      rel: "",
      setAttribute: vi.fn(),
      click,
      remove: vi.fn(),
    }))
    vi.stubGlobal("document", { createElement, body: { appendChild } })
    vi.stubGlobal("window", {
      open,
      shopify: undefined,
      location: { origin: "https://example.com" },
      document: { createElement, body: { appendChild } },
    })

    expect(openOutsideShopifyEmbed("https://example.com/sp/a/b", "blank")).toBe(true)
    expect(createElement).toHaveBeenCalledWith("a")
    expect(click).toHaveBeenCalledTimes(1)
    // Replacing the Admin shell loses the merchant's place in the app.
    expect(open).not.toHaveBeenCalledWith("https://example.com/sp/a/b", "_top")
  })

  it("uses top-level navigation for OAuth/billing mode", () => {
    const open = vi.fn(() => null)
    const top = { location: { href: "" } }
    vi.stubGlobal("window", {
      open,
      top,
      shopify: undefined,
      location: { origin: "https://example.com" },
    })
    expect(openOutsideShopifyEmbed("https://shop.myshopify.com/admin/oauth/authorize", "top")).toBe(true)
    expect(top.location.href).toContain("/admin/oauth/authorize")
  })
})
