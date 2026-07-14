import { describe, expect, it } from "vitest"
import { shouldBypassScanTelemetry } from "@/lib/public-passport-consumer"

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
