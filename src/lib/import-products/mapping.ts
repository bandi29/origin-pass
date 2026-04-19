import type { ColumnMapping, ImportFieldKey } from "./types"
import { IMPORT_FIELD_KEYS } from "./types"

/** Normalize header cell for matching */
export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

const SYNONYMS: Record<ImportFieldKey, string[]> = {
  product_name: ["product_name", "name", "title", "product", "productname", "item_name"],
  product_id: ["product_id", "sku", "article", "article_id", "item_id", "style", "model", "productid", "sku_code"],
  category: ["category", "type", "product_category", "class"],
  brand: ["brand", "brand_name", "maker", "manufacturer", "label"],
  origin_country: ["origin_country", "country", "country_of_origin", "made_in", "origin", "co"],
  material: ["material", "materials", "composition", "fabric"],
  batch_number: ["batch_number", "batch", "lot", "lot_number", "production_batch"],
  manufacture_date: ["manufacture_date", "mfg_date", "production_date", "date", "made_on"],
  certifications: ["certifications", "certification", "certs", "labels", "standards"],
  qr_code: ["qr_code", "qr", "qrvalue", "gtin", "digital_link"],
}

export function guessMapping(headers: string[]): ColumnMapping {
  const normToOriginal = new Map<string, string>()
  for (const h of headers) {
    const n = normalizeHeader(h)
    if (n && !normToOriginal.has(n)) normToOriginal.set(n, h)
  }

  const usedOriginals = new Set<string>()
  const mapping: ColumnMapping = {}

  const assign = (field: ImportFieldKey, originalHeader: string) => {
    mapping[field] = originalHeader
    usedOriginals.add(originalHeader)
  }

  for (const field of IMPORT_FIELD_KEYS) {
    const candidates = SYNONYMS[field]
    let found: string | undefined
    for (const c of candidates) {
      if (normToOriginal.has(c) && !usedOriginals.has(normToOriginal.get(c)!)) {
        found = normToOriginal.get(c)
        break
      }
    }
    if (found) {
      assign(field, found)
      continue
    }
    for (const [norm, orig] of normToOriginal) {
      if (usedOriginals.has(orig)) continue
      if (candidates.some((c) => norm === c || norm.includes(c) || c.includes(norm))) {
        assign(field, orig)
        break
      }
    }
  }

  return mapping
}

export function isMappingComplete(
  mapping: ColumnMapping,
  required: ImportFieldKey[],
): { ok: boolean; missing: ImportFieldKey[] } {
  const missing = required.filter((f) => !mapping[f] || mapping[f]!.trim() === "")
  return { ok: missing.length === 0, missing }
}
