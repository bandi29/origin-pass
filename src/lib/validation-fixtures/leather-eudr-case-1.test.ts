import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const FIXTURE_DIR = join(process.cwd(), "public/test-fixtures/validation")

describe("leather-eudr-case-1 static fixtures", () => {
  it("serves manifest, PDF, and plain text for validation", () => {
    const manifestPath = join(FIXTURE_DIR, "leather-eudr-case-1.manifest.json")
    const pdfPath = join(FIXTURE_DIR, "leather-eudr-case-1.pdf")
    const txtPath = join(FIXTURE_DIR, "leather-eudr-case-1.txt")

    expect(existsSync(manifestPath), manifestPath).toBe(true)
    expect(existsSync(pdfPath), pdfPath).toBe(true)
    expect(existsSync(txtPath), txtPath).toBe(true)

    const raw = readFileSync(manifestPath, "utf8")
    const manifest = JSON.parse(raw) as {
      testCaseId: string
      targetFields: {
        complianceCategory: string
        primaryMaterial: string
        eudrDueDiligenceStatement: string
        originGeo: { latitude: number; longitude: number }
      }
      invoice: { number: string }
    }

    expect(manifest.testCaseId).toBe("leather-eudr-case-1")
    expect(manifest.targetFields.complianceCategory).toBe("Leather")
    expect(manifest.targetFields.primaryMaterial).toContain("Bovine Leather")
    expect(manifest.targetFields.eudrDueDiligenceStatement).toBe("DDS-ITA-2026-X884")
    expect(manifest.targetFields.originGeo.latitude).toBeCloseTo(43.7696, 4)
    expect(manifest.targetFields.originGeo.longitude).toBeCloseTo(11.2558, 4)
    expect(manifest.invoice.number).toBe("LT-8822")

    const txt = readFileSync(txtPath, "utf8")
    expect(txt).toContain("EUDR Due Diligence Statement: DDS-ITA-2026-X884")
    expect(txt).toContain("43.7696, 11.2558")

    const pdf = readFileSync(pdfPath)
    expect(pdf.length).toBeGreaterThan(500)
    expect(pdf.slice(0, 5).toString("binary")).toBe("%PDF-")
  })
})
