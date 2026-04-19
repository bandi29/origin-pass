import Papa from "papaparse"
import * as XLSX from "xlsx"

const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Larger cap for async job uploads (still bounded for memory on XLSX path). */
export const MAX_ASYNC_FILE_BYTES = 50 * 1024 * 1024
const MAX_ROWS = 5000
const PREVIEW_ROWS = 10

export type ParsedSheet = {
  headers: string[]
  rows: Record<string, string>[]
}

function rowToStringRecord(row: Record<string, unknown>, headers: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers) {
    const v = row[h]
    if (v === null || v === undefined) out[h] = ""
    else if (typeof v === "number" || typeof v === "boolean") out[h] = String(v)
    else if (v instanceof Date) out[h] = v.toISOString().slice(0, 10)
    else out[h] = String(v).trim()
  }
  return out
}

function isZipMagic(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b
}

export function assertAllowedFile(
  name: string,
  buf: Buffer,
  maxBytes: number = MAX_FILE_BYTES,
): { ok: true } | { ok: false; error: string } {
  const lower = name.toLowerCase()
  if (buf.length === 0) return { ok: false, error: "File is empty." }
  if (buf.length > maxBytes)
    return { ok: false, error: `File exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit.` }
  if (lower.endsWith(".csv")) {
    return { ok: true }
  }
  if (lower.endsWith(".xlsx")) {
    if (!isZipMagic(buf)) return { ok: false, error: "Invalid Excel file (expected ZIP container)." }
    return { ok: true }
  }
  return { ok: false, error: "Only .csv and .xlsx files are supported." }
}

export function parseSpreadsheet(filename: string, buf: Buffer): ParsedSheet | { error: string } {
  const check = assertAllowedFile(filename, buf)
  if (!check.ok) return { error: check.error }

  const lower = filename.toLowerCase()
  if (lower.endsWith(".csv")) {
    const text = buf.toString("utf8")
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    })
    if (parsed.errors?.length) {
      const fatal = parsed.errors.find((e) => e.type === "Quotes" || e.type === "Delimiter")
      if (fatal) return { error: `CSV parse error: ${fatal.message}` }
    }
    const data = (parsed.data || []).filter((r) => Object.values(r).some((v) => String(v).trim() !== ""))
    if (data.length === 0) return { error: "No data rows found in CSV." }
    const headers = parsed.meta.fields?.filter(Boolean) as string[]
    if (!headers?.length) return { error: "CSV has no header row." }
    const rows = data.slice(0, MAX_ROWS).map((r) => {
      const o: Record<string, string> = {}
      for (const h of headers) o[h] = String(r[h] ?? "").trim()
      return o
    })
    return { headers, rows }
  }

  if (lower.endsWith(".xlsx")) {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { error: "Excel workbook has no sheets." }
    const sheet = wb.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
    if (!json.length) return { error: "First sheet is empty." }
    const headers = Object.keys(json[0]!).map((k) => k.trim()).filter(Boolean)
    if (!headers.length) return { error: "Could not read column headers." }
    const rows = json.slice(0, MAX_ROWS).map((r) => rowToStringRecord(r, headers))
    return { headers, rows }
  }

  return { error: "Unsupported format." }
}

export function previewRows(rows: Record<string, string>[], n = PREVIEW_ROWS) {
  return rows.slice(0, n)
}

export { MAX_FILE_BYTES, MAX_ROWS, PREVIEW_ROWS }
