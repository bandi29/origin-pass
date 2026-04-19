import { buildProductJsonLd } from "@/lib/dpp-export"
import type { MappedRow } from "./types"
import { generateImportQrRef } from "./qr"
import { parseManufactureDate, sanitizeProductText } from "./validate"

/** JSON objects for merge_products_import_batch RPC (matches SQL function keys). */
export function mappedRowsToMergeJson(
  rows: MappedRow[],
  profileBrandName: string | null,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const row of rows) {
    const name = sanitizeProductText(row.product_name, 500)
    const sku = sanitizeProductText(row.product_id, 200)
    const category = sanitizeProductText(row.category, 200)
    const brand = sanitizeProductText(row.brand, 200)
    const originCountry = sanitizeProductText(row.origin_country, 200)
    const materials = row.material ? sanitizeProductText(row.material, 2000) : ""

    let mfg: string | null = null
    if (row.manufacture_date) {
      const p = parseManufactureDate(row.manufacture_date)
      if (p.ok && p.iso) mfg = p.iso
    }

    const certifications =
      row.certifications === null || row.certifications === undefined
        ? []
        : Array.isArray(row.certifications) || typeof row.certifications === "object"
          ? row.certifications
          : [String(row.certifications)]
    const qrRef = row.qr_code?.trim() || generateImportQrRef()

    const jsonLd = buildProductJsonLd({
      name,
      story: null,
      materials: materials || null,
      origin: originCountry,
      lifecycle: null,
      imageUrl: null,
      brandName: brand || profileBrandName,
    })

    out.push({
      name,
      sku,
      category,
      brand,
      materials: materials || "",
      origin: originCountry,
      origin_country: originCountry,
      batch_number: row.batch_number ? sanitizeProductText(row.batch_number, 200) : "",
      manufacture_date: mfg ?? "",
      certifications,
      import_qr_ref: sanitizeProductText(qrRef, 500),
      json_ld: jsonLd,
    })
  }
  return out
}
