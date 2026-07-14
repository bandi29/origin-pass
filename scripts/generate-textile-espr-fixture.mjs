/**
 * Generates static validation fixtures for Test Case 2: Textile (ESPR & fiber logic).
 * Run: node scripts/generate-textile-espr-fixture.mjs
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
  "Test Case 2: Textile (Tests ESPR & Fiber Logic)",
  "",
  "Target Fields: Compliance category (Textile), Material %, Recycled Content, Wash Care.",
  "",
  "CERTIFICATE OF ORIGIN: #TEX-4411",
  "Supplier: GreenWeave Textiles Ltd.",
  "Date: March 22, 2026",
  "",
  "Technical Specifications:",
  "",
  "Article: Organic Cotton Canvas (Heavyweight)",
  "",
  "Composition: 100% GOTS Certified Organic Cotton",
  "",
  "Dyeing: Low-impact, REACH compliant non-toxic pigments",
  "",
  "Sustainability & Lifecycle:",
  "",
  "Recycled Content: 0% (Virgin Organic)",
  "",
  "Expected Lifespan: 10+ years (Heavy-duty grade)",
  "",
  "Repairability Index: High (Standard stitching)",
  "",
  "Country of Origin: Portugal",
  "",
  "Factory Code: P-LIS-992",
]

function isBoldHeader(line) {
  if (!line.length) return false
  return (
    line.startsWith("Test Case") ||
    line.startsWith("CERTIFICATE OF ORIGIN:") ||
    line === "Technical Specifications:" ||
    line === "Sustainability & Lifecycle:"
  )
}

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
    const header = isBoldHeader(line)
    draw(line, { bold: header, size: header ? 11 : 10 })
  }

  const bytes = await pdf.save()
  const pdfPath = join(OUT_DIR, "textile-espr-case-2.pdf")
  writeFileSync(pdfPath, bytes)
  console.log("Wrote", pdfPath, `(${bytes.length} bytes)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
