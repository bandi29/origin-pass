import { describe, expect, it } from "vitest"
import {
  coerceSpreadsheetText,
  isValidOriginGeo,
  resolveComplianceTier,
} from "@/lib/compliance-validation-server"

describe("compliance-validation-server", () => {
  it("validates geographic origin strings", () => {
    expect(isValidOriginGeo("Florence, IT")).toBe(true)
    expect(isValidOriginGeo("unknown")).toBe(false)
    expect(isValidOriginGeo("—")).toBe(false)
  })

  it("marks rows EU Validated when origin and description are present", () => {
    expect(
      resolveComplianceTier({
        originGeo: "Porto, PT",
        description: "GOTS-certified organic cotton field jacket.",
      }),
    ).toEqual({ tier: "fully_compliant", label: "EU Validated" })
  })

  it("flags incomplete manifest rows for action", () => {
    expect(
      resolveComplianceTier({
        originGeo: "",
        description: "ESPR-2026 compliant leather",
      }),
    ).toEqual({ tier: "action_required", label: "Missing Material Certs" })
  })

  it("coerces nullish and numeric sheet values without throwing", () => {
    expect(coerceSpreadsheetText(null)).toBe("")
    expect(coerceSpreadsheetText(undefined)).toBe("")
    expect(coerceSpreadsheetText(837492)).toBe("837492")

    expect(resolveComplianceTier(null)).toEqual({
      tier: "action_required",
      label: "Missing Material Certs",
    })
    expect(resolveComplianceTier(undefined)).toEqual({
      tier: "action_required",
      label: "Missing Material Certs",
    })
    expect(resolveComplianceTier({ originGeo: "Italy", description: undefined })).toEqual({
      tier: "action_required",
      label: "Missing Material Certs",
    })
    expect(resolveComplianceTier({ originGeo: "Italy", description: null })).toEqual({
      tier: "action_required",
      label: "Missing Material Certs",
    })
    expect(
      resolveComplianceTier({
        originGeo: "Italy · Florence",
        description: 2026,
      }),
    ).toEqual({ tier: "fully_compliant", label: "EU Validated" })
  })
})
