import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib"
import type { BatchExportData } from "@/lib/dpp-export"

const MARGIN = 50
const LINE = 14
const PAGE_W = 595
const PAGE_H = 842
const MAX_CHARS = 72
const BOTTOM = 80

function wrap(text: string): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length <= MAX_CHARS) cur = next
    else {
      if (cur) lines.push(cur)
      cur = w.length > MAX_CHARS ? w.slice(0, MAX_CHARS) : w
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [""]
}

export async function buildOriginalityCertificatePdf(
  data: BatchExportData,
  exportDate: Date
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const draw = (text: string, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = opts.size ?? 10
    const f = opts.bold ? fontBold : font
    const color = opts.color ?? rgb(0.15, 0.18, 0.22)
    const step = Math.max(LINE, Math.ceil(size * 1.1))
    for (const line of wrap(text)) {
      if (y < BOTTOM) {
        page = pdf.addPage([PAGE_W, PAGE_H])
        y = PAGE_H - MARGIN
      }
      page.drawText(line, { x: MARGIN, y, size, font: f, color })
      y -= step
    }
  }

  draw("Certificate of Originality", { bold: true, size: 20, color: rgb(0.1, 0.15, 0.2) })
  y -= 10

  draw("Digital Product Passport — batch attestation", { size: 11, color: rgb(0.35, 0.4, 0.45) })
  y -= 12

  const body = [
    "This certificate attests that the production batch identified below was recorded in OriginPass with verifiable digital passports and traceability data, including machine-readable exports for EU DPP expectations.",
    "",
    `Brand: ${data.brand.brand_name ?? "—"}`,
    `Product: ${data.product.name}`,
    `Batch / run: ${data.batch.production_run_name ?? "—"}`,
    `Artisan / maker: ${data.batch.artisan_name ?? "—"}`,
    `Location: ${data.batch.location ?? "—"}`,
    `Production date: ${
      data.batch.produced_at
        ? new Date(data.batch.produced_at).toISOString().split("T")[0]
        : "—"
    }`,
    `Units in batch: ${data.items.length}`,
    `Batch ID: ${data.batch.id}`,
    "",
    `Issued: ${exportDate.toISOString().split("T")[0]} (UTC)`,
    "",
    "For customs or registry submission, use the JSON-LD and CSV files in the same compliance package alongside this certificate.",
  ].join("\n")

  for (const para of body.split("\n")) {
    if (para === "") {
      y -= LINE / 2
      continue
    }
    draw(para, {})
  }

  if (y < BOTTOM + 24) {
    page = pdf.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MARGIN
  }
  page.drawText("OriginPass — Artisan traceability & digital product passports", {
    x: MARGIN,
    y: MARGIN + 16,
    size: 8,
    font,
    color: rgb(0.5, 0.52, 0.55),
  })

  return pdf.save()
}
