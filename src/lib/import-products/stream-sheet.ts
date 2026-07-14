import { createReadStream } from "node:fs"
import { parse } from "csv-parse"
import * as XLSX from "xlsx"

import {
  assertAllowedFile,
  CSV_ZIP_MISMATCH_ERROR,
  isZipMagic,
  MAX_ASYNC_FILE_BYTES,
  NUMBERS_EXPORT_HINT,
} from "./parse-file"
import { sheetToStringRecordRows } from "./xlsx-smart"

const MAX_ASYNC_ROWS = 200_000

export type SheetMeta = {
  headers: string[]
  totalRows: number
  preview: Record<string, string>[]
}

/** Stream CSV: count rows + first N preview rows without loading whole file into memory. */
export async function analyzeCsvFile(
  absPath: string,
  fileName: string,
  previewLimit = 10,
): Promise<SheetMeta | { error: string }> {
  const fs = await import("node:fs/promises")
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".numbers")) return { error: NUMBERS_EXPORT_HINT }
  if (!lower.endsWith(".csv")) {
    return { error: "Streaming analysis expects a .csv file." }
  }
  const st = await fs.stat(absPath)
  if (st.size === 0) return { error: "File is empty." }
  if (st.size > MAX_ASYNC_FILE_BYTES) {
    return { error: `File exceeds ${Math.round(MAX_ASYNC_FILE_BYTES / (1024 * 1024))}MB limit.` }
  }

  const head = Buffer.alloc(4)
  const fh = await fs.open(absPath, "r")
  try {
    await fh.read(head, 0, 4, 0)
  } finally {
    await fh.close()
  }
  if (isZipMagic(head)) return { error: CSV_ZIP_MISMATCH_ERROR }

  try {
    const stream = createReadStream(absPath, { encoding: "utf8" })
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
    stream.pipe(parser)

    let headers: string[] | null = null
    let total = 0
    const preview: Record<string, string>[] = []

    const iterable = parser as AsyncIterable<Record<string, unknown>>
    for await (const row of iterable) {
      if (!headers) {
        headers = Object.keys(row).map((h) => h.trim()).filter(Boolean)
      }
      total++
      if (preview.length < previewLimit) {
        const o: Record<string, string> = {}
        for (const h of headers) {
          const v = row[h]
          o[h] = v == null ? "" : typeof v === "string" ? v : String(v)
        }
        preview.push(o)
      }
      if (total > MAX_ASYNC_ROWS) {
        stream.destroy()
        return { error: `Maximum ${MAX_ASYNC_ROWS} rows per import.` }
      }
    }

    if (!headers?.length || total === 0) {
      return {
        error:
          "No data rows found in CSV. If this file is from Apple Numbers, use File → Export To → CSV (or Excel) — do not rename a .numbers file to .csv.",
      }
    }
    return { headers, totalRows: total, preview }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "CSV parse error" }
  }
}

/** XLSX: workbook is loaded once (10MB cap in parse-file). Iterate rows in chunks in the worker. */
export function analyzeXlsxBuffer(fileName: string, buf: Buffer): SheetMeta | { error: string } {
  const check = assertAllowedFile(fileName, buf, MAX_ASYNC_FILE_BYTES)
  if (!check.ok) return { error: check.error }

  const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { error: "Excel workbook has no sheets." }
  const sheet = wb.Sheets[sheetName]
  const { headers, rows } = sheetToStringRecordRows(sheet)
  if (!headers.length) return { error: "Could not read column headers." }
  if (!rows.length) return { error: "First sheet is empty or has no data rows after the header." }

  const capped = rows.slice(0, MAX_ASYNC_ROWS)
  return {
    headers,
    totalRows: capped.length,
    preview: capped.slice(0, 10),
  }
}

export { MAX_ASYNC_ROWS }
