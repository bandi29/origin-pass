import { describe, expect, it } from "vitest"
import { appendPassportPreviewQuery, shouldBypassScanTelemetry } from "@/lib/public-passport-consumer"

describe("shouldBypassScanTelemetry", () => {
  it("returns true for preview=true", () => {
    expect(shouldBypassScanTelemetry({ preview: "true" })).toBe(true)
    expect(shouldBypassScanTelemetry(new URLSearchParams("preview=true"))).toBe(true)
  })

  it("returns true for admin=true", () => {
    expect(shouldBypassScanTelemetry({ admin: "true" })).toBe(true)
    expect(shouldBypassScanTelemetry(new URLSearchParams("admin=1"))).toBe(true)
  })

  it("returns false without preview flags", () => {
    expect(shouldBypassScanTelemetry({})).toBe(false)
    expect(shouldBypassScanTelemetry(null)).toBe(false)
  })
})

describe("appendPassportPreviewQuery", () => {
  it("adds preview and optional shop/host for merchant return navigation", () => {
    const out = appendPassportPreviewQuery("https://origin-pass.vercel.app/sp/demo/1", {
      shop: "demo.myshopify.com",
      host: "abc",
    })
    const u = new URL(out)
    expect(u.searchParams.get("preview")).toBe("true")
    expect(u.searchParams.get("shop")).toBe("demo.myshopify.com")
    expect(u.searchParams.get("host")).toBe("abc")
  })
})
