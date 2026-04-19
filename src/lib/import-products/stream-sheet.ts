import { createReadStream } from "node:fs"
import { parse } from "csv-parse"
import * as XLSX from "xlsx"

import { assertAllowedFile, MAX_ASYNC_FILE_BYTES } from "./parse-file"

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
  if (!fileName.toLowerCase().endsWith(".csv")) {
    return { error: "Streaming analysis expects a .csv file." }
  }
  const st = await fs.stat(absPath)
  if (st.size === 0) return { error: "File is empty." }
  if (st.size > MAX_ASYNC_FILE_BYTES) {
    return { error: `File exceeds ${Math.round(MAX_ASYNC_FILE_BYTES / (1024 * 1024))}MB limit.` }
  }

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
      return { error: "No data rows found in CSV." }
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
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
  if (!json.length) return { error: "First sheet is empty." }
  const headers = Object.keys(json[0]!).map((k) => k.trim()).filter(Boolean)
  if (!headers.length) return { error: "Could not read column headers." }

  const rows = json.slice(0, MAX_ASYNC_ROWS).map((r) => {
    const o: Record<string, string> = {}
    for (const h of headers) {
      const v = r[h]
      if (v == null) o[h] = ""
      else if (typeof v === "number" || typeof v === "boolean") o[h] = String(v)
      else if (v instanceof Date) o[h] = v.toISOString().slice(0, 10)
      else o[h] = String(v).trim()
    }
    return o
  })

  return {
    headers,
    totalRows: rows.length,
    preview: rows.slice(0, 10),
  }
}

export { MAX_ASYNC_ROWS }
