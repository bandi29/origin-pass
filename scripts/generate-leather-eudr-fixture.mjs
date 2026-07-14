/**
 * Generates static validation fixtures for Test Case 1: Leather (EUDR & tanning).
 * Run: node scripts/generate-leather-eudr-fixture.mjs
 */
import { writeFileSync, mkdirSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = join(ROOT, "public", "test-fixtures", "validation")

const MARGIN = 50
const LINE = 13
const PAGE_W = 595
const PAGE_H = 842

const LINES = [
  "Test Case 1: Leather (Tests EUDR & Tanning Logic)",
  "",
  "Target Fields: Compliance category (Leather), Primary material, EUDR reference,",
  "Origin geo (lat/long).",
  "",
  "INVOICE: #LT-8822",
  "Vendor: Florentine Hide & Grain S.p.A.",
  "Date: April 10, 2026",
  "",
  "Product Details:",
  "",
  "Material: Vegetable-Tanned Full-Grain Bovine Leather",
  "",
  "Quantity: 120 sq. ft.",
  "",
  "Batch ID: B-9932-ITA",
  "",
  "DPP / Compliance Metadata:",
  "",
  "Raw Material Origin: Italy (Tuscany Region)",
  "",
  "Geolocation (Farm/Plot): 43.7696, 11.2558",
  "",
  "EUDR Due Diligence Statement: DDS-ITA-2026-X884",
  "",
  "Tanning Method: Chrome-free, Vegetable extracts",
  "",
  "LWG Certification: Gold Grade (Ref: LWG-552)",
]

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const draw = (text, { bold = false, size = 10 } = {}) => {
    const f = bold ? fontBold : font
    page.drawText(text, {
      x: MARGIN,
      y,
      size,
      font: f,
      color: rgb(0.12, 0.14, 0.18),
    })
    y -= Math.max(LINE, Math.ceil(size * 1.15))
  }

  draw("OriginPass — Validation Fixture", { bold: true, size: 14 })
  y -= 6
  for (const line of LINES) {
    if (y < 72) break
    const isHeader =
      line.startsWith("Test Case") ||
      line.startsWith("INVOICE:") ||
      line === "Product Details:" ||
      line === "DPP / Compliance Metadata:"
    draw(line, { bold: isHeader && line.length > 0, size: isHeader ? 11 : 10 })
  }

  const bytes = await pdf.save()
  const pdfPath = join(OUT_DIR, "leather-eudr-case-1.pdf")
  writeFileSync(pdfPath, bytes)
  console.log("Wrote", pdfPath, `(${bytes.length} bytes)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
