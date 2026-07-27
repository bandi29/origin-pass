import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import {
  publicAbsoluteUrl,
  relativeRedirectLocation,
  resolvePublicRequestHref,
  resolvePublicRequestOrigin,
} from "./public-request-origin"

function req(url: string, headers?: Record<string, string>) {
  return new NextRequest(url, { headers })
}

describe("public-request-origin", () => {
  it("uses nextUrl.origin when no forwarded headers", () => {
    expect(resolvePublicRequestOrigin(req("http://localhost:3000/01/123"))).toBe(
      "http://localhost:3000",
    )
  })

  it("prefers x-forwarded-host/proto (Cloudflare tunnel)", () => {
    const r = req("http://localhost:3000/01/7349012800127", {
      "x-forwarded-host": "replacing-vintage-anniversary-feof.trycloudflare.com",
      "x-forwarded-proto": "https",
    })
    expect(resolvePublicRequestOrigin(r)).toBe(
      "https://replacing-vintage-anniversary-feof.trycloudflare.com",
    )
    expect(resolvePublicRequestHref(r)).toBe(
      "https://replacing-vintage-anniversary-feof.trycloudflare.com/01/7349012800127",
    )
  })

  it("builds absolute public URLs from a path", () => {
    const r = req("http://127.0.0.1:3000/01/x", {
      "x-forwarded-host": "tunnel.trycloudflare.com",
      "x-forwarded-proto": "https",
    })
    expect(publicAbsoluteUrl(r, "/sp/demo/1?variant=2").toString()).toBe(
      "https://tunnel.trycloudflare.com/sp/demo/1?variant=2",
    )
  })

  it("relativeRedirectLocation strips host so Safari stays on the tunnel", () => {
    expect(relativeRedirectLocation("/sp/demo/1?variant=2")).toBe("/sp/demo/1?variant=2")
    expect(relativeRedirectLocation("/sp/demo/1")).toBe("/sp/demo/1")
  })
})
