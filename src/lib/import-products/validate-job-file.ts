import { createReadStream, readFileSync } from "node:fs"
import { parse } from "csv-parse"
import * as XLSX from "xlsx"

import { createClient } from "@/lib/supabase/server"
import type { ColumnMapping } from "@/lib/import-products/types"
import { validateMappedRows } from "@/lib/import-products/validate"
import { sheetToStringRecordRows } from "@/lib/import-products/xlsx-smart"
import type { ValidateResult } from "@/lib/import-products/types"

const BATCH = 2000

function isXlsx(name: string): boolean {
  return name.toLowerCase().endsWith(".xlsx")
}

async function* iterateRows(absPath: string, fileName: string): AsyncGenerator<Record<string, string>> {
  if (isXlsx(fileName)) {
    const buf = readFileSync(absPath)
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return
    const sheet = wb.Sheets[sheetName]
    const { headers, rows } = sheetToStringRecordRows(sheet)
    if (!headers.length || !rows.length) return
    for (const row of rows) {
      yield row
    }
    return
  }

  const stream = createReadStream(absPath, { encoding: "utf8" })
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })
  const iterable = stream.pipe(parser) as AsyncIterable<Record<string, unknown>>
  for await (const rec of iterable) {
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(rec)) {
      row[k.trim()] = v == null ? "" : String(v)
    }
    yield row
  }
}

export async function validateMappedRowsFromJobFile(
  absPath: string,
  fileName: string,
  mapping: ColumnMapping,
  existingSkusLower: Set<string>,
): Promise<ValidateResult> {
  const allErrors: ValidateResult["errors"] = []
  const mappedPreview: ValidateResult["mappedPreview"] = []
  let totalRows = 0
  let validRows = 0
  let offset = 0
  let batch: Record<string, string>[] = []

  for await (const row of iterateRows(absPath, fileName)) {
    totalRows++
    batch.push(row)
    if (batch.length >= BATCH) {
      const res = validateMappedRows(batch, mapping, existingSkusLower, { allowExistingSkus: true })
      validRows += res.validRows
      for (const e of res.errors) {
        allErrors.push({ ...e, rowIndex: e.rowIndex + offset })
      }
      for (const m of res.mappedPreview) {
        if (mappedPreview.length < 10) mappedPreview.push(m)
      }
      offset += batch.length
      batch = []
    }
  }
  if (batch.length) {
    const res = validateMappedRows(batch, mapping, existingSkusLower, { allowExistingSkus: true })
    validRows += res.validRows
    for (const e of res.errors) {
      allErrors.push({ ...e, rowIndex: e.rowIndex + offset })
    }
    for (const m of res.mappedPreview) {
      if (mappedPreview.length < 10) mappedPreview.push(m)
    }
  }

  return {
    totalRows,
    validRows,
    failedRows: totalRows - validRows,
    errors: allErrors,
    mappedPreview,
  }
}

export async function loadExistingSkuSet(brandId: string): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: existing } = await supabase.from("products").select("sku").eq("brand_id", brandId)
  const existingSkus = new Set<string>()
  for (const p of existing ?? []) {
    const s = p.sku
    if (typeof s === "string" && s.trim()) existingSkus.add(s.trim().toLowerCase())
  }
  return existingSkus
}
