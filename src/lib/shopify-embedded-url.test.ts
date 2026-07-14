import { describe, expect, it } from "vitest"
import { shopifyEmbeddedHomeHref, shopifyEmbeddedQueryString } from "./shopify-embedded-url"

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
