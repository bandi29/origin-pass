import type { ColumnMapping, MappedRow, RawRow, RowValidationError, ValidateResult } from "./types"
import { REQUIRED_IMPORT_FIELDS } from "./types"

function parseCertifications(raw: string): unknown {
  const t = raw.trim()
  if (!t) return []
  try {
    const j = JSON.parse(t)
    if (Array.isArray(j)) return j
    if (typeof j === "object" && j) return j
  } catch {
    /* fall through */
  }
  return t.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
}

/** Accept ISO, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY heuristics */
export function parseManufactureDate(raw: string): { ok: true; iso: string } | { ok: false; reason: string } {
  const t = raw.trim()
  if (!t) return { ok: true, iso: "" }

  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (iso.test(t)) {
    const d = new Date(t + "T00:00:00.000Z")
    if (!Number.isNaN(d.getTime())) return { ok: true, iso: t }
  }

  const d1 = Date.parse(t)
  if (!Number.isNaN(d1)) {
    const d = new Date(d1)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return { ok: true, iso: `${y}-${m}-${day}` }
  }

  const slash = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/)
  if (slash) {
    let a = Number(slash[1])
    let b = Number(slash[2])
    let y = Number(slash[3])
    if (y < 100) y += 2000
    let month = a
    let day = b
    if (a > 12) {
      day = a
      month = b
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, reason: "Invalid calendar date" }
    const mm = String(month).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    return { ok: true, iso: `${y}-${mm}-${dd}` }
  }

  return { ok: false, reason: "Unrecognized date format" }
}

function pick(raw: RawRow, mapping: ColumnMapping, key: keyof ColumnMapping): string {
  const col = mapping[key]
  if (!col) return ""
  return String(raw[col] ?? "").trim()
}

export function applyMapping(raw: RawRow, mapping: ColumnMapping): MappedRow {
  const qr = pick(raw, mapping, "qr_code")
  return {
    product_name: pick(raw, mapping, "product_name"),
    product_id: pick(raw, mapping, "product_id"),
    category: pick(raw, mapping, "category"),
    brand: pick(raw, mapping, "brand"),
    origin_country: pick(raw, mapping, "origin_country"),
    material: (() => {
      const m = pick(raw, mapping, "material")
      return m || null
    })(),
    batch_number: (() => {
      const b = pick(raw, mapping, "batch_number")
      return b || null
    })(),
    manufacture_date: (() => {
      const d = pick(raw, mapping, "manufacture_date")
      return d || null
    })(),
    certifications: parseCertifications(pick(raw, mapping, "certifications")),
    qr_code: qr || null,
  }
}

export function validateMappedRows(
  rows: RawRow[],
  mapping: ColumnMapping,
  existingSkusLower: Set<string>,
  options?: { allowExistingSkus?: boolean },
): ValidateResult {
  const errors: RowValidationError[] = []
  const mappedPreview: MappedRow[] = []
  const seenSku = new Map<string, number>()
  let validRows = 0

  rows.forEach((raw, rowIndex) => {
    const m = applyMapping(raw, mapping)
    const rowErrors: string[] = []

    for (const req of REQUIRED_IMPORT_FIELDS) {
      const val = m[req as keyof MappedRow]
      const s = typeof val === "string" ? val : val == null ? "" : String(val)
      if (!s || !String(s).trim()) {
        rowErrors.push(`Missing ${req}`)
        errors.push({ rowIndex, field: req, message: `Missing ${req}` })
      }
    }

    const skuKey = m.product_id.trim().toLowerCase()
    if (m.product_id.trim()) {
      if (seenSku.has(skuKey)) {
        const first = seenSku.get(skuKey)!
        rowErrors.push(`Duplicate SKU (same as row ${first + 1})`)
        errors.push({
          rowIndex,
          field: "product_id",
          message: `Duplicate product_id in file (see row ${first + 1})`,
        })
      } else {
        seenSku.set(skuKey, rowIndex)
      }
      if (!options?.allowExistingSkus && existingSkusLower.has(skuKey)) {
        rowErrors.push("SKU already exists in your catalog")
        errors.push({ rowIndex, field: "product_id", message: "SKU already exists in your catalog" })
      }
    }

    if (m.manufacture_date) {
      const p = parseManufactureDate(m.manufacture_date)
      if (!p.ok) {
        rowErrors.push(p.reason)
        errors.push({ rowIndex, field: "manufacture_date", message: p.reason })
      }
    }

    if (rowErrors.length === 0) {
      validRows++
      if (mappedPreview.length < 10) mappedPreview.push(m)
    }
  })

  return {
    totalRows: rows.length,
    validRows,
    failedRows: rows.length - validRows,
    errors,
    mappedPreview,
  }
}

export function sanitizeProductText(s: string, max = 2000): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max).trim()
}
