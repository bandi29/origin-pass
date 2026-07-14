import type { WorkSheet } from "xlsx"
import * as XLSX from "xlsx"

export function xlsxCellToString(v: unknown): string {
  if (v == null) return ""
  if (typeof v === "string") return v.trim()
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

/** Heuristic: header rows usually have 2+ labels and are not mostly numeric/date-like cells. */
export function rowLooksLikeHeader(cells: unknown[]): boolean {
  const parts = (cells ?? []).map(xlsxCellToString)
  const nonEmpty = parts.filter((s) => s.length > 0)
  if (nonEmpty.length < 2) return false
  let numericLike = 0
  for (const s of nonEmpty) {
    if (/^-?\d+(\.\d+)?$/.test(s)) numericLike++
    else if (/^\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?$/.test(s)) numericLike++
  }
  return numericLike < nonEmpty.length * 0.6
}

/** First plausible header row in the first `maxScan` rows (title rows above headers are skipped). */
export function detectHeaderRowIndex(aoa: unknown[][], maxScan = 25): number {
  const limit = Math.min(aoa.length, maxScan)
  for (let i = 0; i < limit; i++) {
    if (rowLooksLikeHeader(aoa[i] ?? [])) return i
  }
  return 0
}

function makeUniqueHeaders(labels: string[]): string[] {
  const seen = new Map<string, number>()
  return labels.map((raw) => {
    const base = raw.trim() || "Column"
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

export type XlsxSheetRecords = {
  headers: string[]
  rows: Record<string, string>[]
  /** 0-based index of the row used as headers (for debugging). */
  headerRowIndex: number
}

/**
 * Parse first worksheet: detect header row (skip title/preamble rows), avoid SheetJS __EMPTY keys.
 */
export function sheetToStringRecordRows(sheet: WorkSheet): XlsxSheetRecords {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][]

  if (!aoa.length) {
    return { headers: [], rows: [], headerRowIndex: 0 }
  }

  const hdrIdx = detectHeaderRowIndex(aoa)
  const headerCells = aoa[hdrIdx] ?? []

  let maxCols = headerCells.length
  for (let i = hdrIdx + 1; i < aoa.length; i++) {
    maxCols = Math.max(maxCols, (aoa[i] ?? []).length)
  }
  maxCols = Math.min(Math.max(maxCols, 1), 512)

  const rawLabels: string[] = []
  for (let j = 0; j < maxCols; j++) {
    const s = xlsxCellToString(headerCells[j] ?? "")
    rawLabels.push(s || `Column ${j + 1}`)
  }
  const headers = makeUniqueHeaders(rawLabels)

  const rows: Record<string, string>[] = []
  for (let i = hdrIdx + 1; i < aoa.length; i++) {
    const line = aoa[i] ?? []
    const o: Record<string, string> = {}
    let any = false
    for (let j = 0; j < headers.length; j++) {
      const v = xlsxCellToString(line[j] ?? "")
      o[headers[j]!] = v
      if (v) any = true
    }
    if (any) rows.push(o)
  }

  return { headers, rows, headerRowIndex: hdrIdx }
}
