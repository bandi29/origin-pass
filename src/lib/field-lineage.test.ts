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
    expect(fieldLineageChip("inherited", false).label).toBe("Inherited")
  })

  it("shows Unverified claim only for conflict", () => {
    expect(fieldLineageChip("conflict", true).label).toBe("⚠ Unverified claim")
    expect(fieldLineageChip("inherited", true).label).not.toContain("Unverified")
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
