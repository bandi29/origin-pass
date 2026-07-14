import { describe, expect, it } from "vitest"
import { getPassportStatusTooltip } from "@/lib/passport-status-tooltips"

describe("passport-status-tooltips", () => {
  it("returns lifecycle-specific guidance", () => {
    expect(getPassportStatusTooltip("active")).toContain("live and publicly accessible")
    expect(getPassportStatusTooltip("revoked")).toContain("permanently flagged")
    expect(getPassportStatusTooltip("expired", "deactivate")).toContain("temporarily paused")
  })
})
