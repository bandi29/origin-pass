import { describe, expect, it } from "vitest"
import { fieldLineageChip, resolveFieldLineage, resolveFieldLineageState } from "./field-lineage"

describe("resolveFieldLineageState", () => {
  it("returns inherited when product value is empty (uses brand default)", () => {
    expect(
      resolveFieldLineageState({
        productValue: "",
        brandDefault: "Florence, Italy",
        productCertPresent: false,
        brandCertPresent: true,
      }),
    ).toBe("inherited")
  })

  it("returns inherited when product value equals brand default even if stored on record", () => {
    expect(
      resolveFieldLineageState({
        productValue: "Florence, Italy",
        brandDefault: "Florence, Italy",
        productCertPresent: false,
        brandCertPresent: true,
      }),
    ).toBe("inherited")
  })

  it("returns overridden when product value differs and product evidence exists", () => {
    expect(
      resolveFieldLineageState({
        productValue: "Vietnam",
        brandDefault: "Florence, Italy",
        productCertPresent: true,
        brandCertPresent: true,
      }),
    ).toBe("overridden")
  })

  it("returns conflict only when product value differs without product evidence", () => {
    expect(
      resolveFieldLineageState({
        productValue: "Vietnam",
        brandDefault: "Florence, Italy",
        productCertPresent: false,
        brandCertPresent: true,
      }),
    ).toBe("conflict")
  })

  it("never returns conflict when values match", () => {
    expect(
      resolveFieldLineageState({
        productValue: "Florence, Italy",
        brandDefault: "Florence, Italy",
        productCertPresent: false,
        brandCertPresent: false,
      }),
    ).toBe("inherited")
  })
})

describe("fieldLineageChip", () => {
  it("shows Inherited ✓ only when inheriting with brand evidence", () => {
    expect(fieldLineageChip("inherited", true).label).toBe("Inherited ✓")
    expect(fieldLineageChip("inherited", false).label).toBe("Inherited · needs evidence")
  })

  it("shows Unverified claim only for conflict", () => {
    expect(fieldLineageChip("conflict", true).label).toBe("⚠ Unverified claim")
    expect(fieldLineageChip("inherited", true).label).not.toContain("Unverified")
  })

  /**
   * The chip is the only per-row explanation of why a passport is not audit-ready.
   * If the blocking state ever reads as a near-twin of the passing state again, a
   * merchant sees an all-green row under a "0 audit-ready" header.
   */
  it("makes the audit-blocking chip visibly distinct from the passing one", () => {
    const passing = fieldLineageChip("inherited", true)
    const blocking = fieldLineageChip("inherited", false)

    expect(blocking.tone).not.toBe(passing.tone)
    // Must not differ from the passing chip by the ✓ glyph alone.
    expect(blocking.label.replace("✓", "").trim()).not.toBe(passing.label.replace("✓", "").trim())
    // Must state the gap in words, not rely on colour.
    expect(blocking.label.toLowerCase()).toContain("needs evidence")
  })

  it("keeps every chip label distinct across all four states", () => {
    const labels = [
      fieldLineageChip("inherited", true).label,
      fieldLineageChip("inherited", false).label,
      fieldLineageChip("overridden", true).label,
      fieldLineageChip("conflict", false).label,
    ]
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe("resolveFieldLineage", () => {
  it("flags audit-ready for inherited + brand cert and overridden + product cert", () => {
    expect(
      resolveFieldLineage({
        productValue: "",
        brandDefault: "Florence, Italy",
        productCertPresent: false,
        brandCertPresent: true,
      }).isAuditReady,
    ).toBe(true)
    expect(
      resolveFieldLineage({
        productValue: "Vietnam",
        brandDefault: "Florence, Italy",
        productCertPresent: true,
        brandCertPresent: false,
      }).isAuditReady,
    ).toBe(true)
  })

  it("flags unverified claim only when value differs without product cert", () => {
    const row = resolveFieldLineage({
      productValue: "Vietnam",
      brandDefault: "Florence, Italy",
      productCertPresent: false,
      brandCertPresent: true,
    })
    expect(row.isUnverifiedClaim).toBe(true)
    expect(row.state).toBe("conflict")
    expect(row.valueDiffersFromBrand).toBe(true)
  })

  it("does not flag unverified when override value matches brand default", () => {
    const row = resolveFieldLineage({
      productValue: "Florence, Italy",
      brandDefault: "Florence, Italy",
      productCertPresent: false,
      brandCertPresent: true,
    })
    expect(row.isUnverifiedClaim).toBe(false)
    expect(row.state).toBe("inherited")
    expect(row.valueDiffersFromBrand).toBe(false)
  })
})
