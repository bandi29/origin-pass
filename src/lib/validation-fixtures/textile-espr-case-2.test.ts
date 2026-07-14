import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { describe, expect, it } from "vitest"

const FIXTURE_DIR = join(process.cwd(), "public/test-fixtures/validation")

describe("textile-espr-case-2 static fixtures", () => {
  it("serves manifest, PDF, and plain text for validation", () => {
    const manifestPath = join(FIXTURE_DIR, "textile-espr-case-2.manifest.json")
    const pdfPath = join(FIXTURE_DIR, "textile-espr-case-2.pdf")
    const txtPath = join(FIXTURE_DIR, "textile-espr-case-2.txt")

    expect(existsSync(manifestPath), manifestPath).toBe(true)
    expect(existsSync(pdfPath), pdfPath).toBe(true)
    expect(existsSync(txtPath), txtPath).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      testCaseId: string
      targetFields: { complianceCategory: string; recycledContentPercentage: number }
      certificate: { number: string }
    }

    expect(manifest.testCaseId).toBe("textile-espr-case-2")
    expect(manifest.targetFields.complianceCategory).toBe("textile")
    expect(manifest.targetFields.recycledContentPercentage).toBe(0)
    expect(manifest.certificate.number).toBe("TEX-4411")

    const txt = readFileSync(txtPath, "utf8")
    expect(txt).toContain("GOTS Certified Organic Cotton")
    expect(txt).toContain("Recycled Content: 0%")

    const pdf = readFileSync(pdfPath)
    expect(pdf.length).toBeGreaterThan(500)
    expect(pdf.slice(0, 5).toString("binary")).toBe("%PDF-")
  })
})
