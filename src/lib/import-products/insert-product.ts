import type { SupabaseClient, User } from "@supabase/supabase-js"
import { buildProductJsonLd } from "@/lib/dpp-export"
import type { MappedRow } from "./types"
import { generateImportQrRef } from "./qr"
import { parseManufactureDate, sanitizeProductText } from "./validate"

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" || message.includes("column") || message.includes("schema cache")
}

export async function insertImportedProductRow(
  supabase: SupabaseClient,
  user: User,
  organizationId: string | null,
  profileBrandName: string | null,
  row: MappedRow,
  importLogId: string,
): Promise<{ ok: true; productId: string } | { ok: false; message: string }> {
  const name = sanitizeProductText(row.product_name, 500)
  const sku = sanitizeProductText(row.product_id, 200)
  const category = sanitizeProductText(row.category, 200)
  const brand = sanitizeProductText(row.brand, 200)
  const originCountry = sanitizeProductText(row.origin_country, 200)
  const materials = row.material ? sanitizeProductText(row.material, 2000) : null

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
    materials,
    origin: originCountry,
    lifecycle: null,
    imageUrl: null,
    brandName: brand || profileBrandName,
  })

  const fullPayload: Record<string, unknown> = {
    brand_id: user.id,
    organization_id: organizationId,
    name,
    sku,
    category,
    brand,
    story: null,
    materials,
    origin: originCountry,
    origin_country: originCountry,
    batch_number: row.batch_number ? sanitizeProductText(row.batch_number, 200) : null,
    manufacture_date: mfg,
    certifications: certifications ?? [],
    import_qr_ref: sanitizeProductText(qrRef, 500),
    import_log_id: importLogId,
    lifecycle: null,
    image_url: null,
    is_archived: false,
    json_ld: jsonLd,
  }

  const tryInsert = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from("products").insert(payload).select("id").single()
    if (error) return { data: null as { id: string } | null, error }
    return { data, error: null }
  }

  let r = await tryInsert(fullPayload)
  if (r.error && isMissingColumnError(r.error)) {
    const slim = {
      brand_id: user.id,
      organization_id: organizationId,
      name,
      sku,
      category,
      brand,
      story: null,
      materials,
      origin: originCountry,
      lifecycle: null,
      image_url: null,
      is_archived: false,
      json_ld: jsonLd,
    }
    r = await tryInsert(slim)
  }

  if (r.error && isMissingColumnError(r.error)) {
    const minimal = {
      brand_id: user.id,
      organization_id: organizationId,
      name,
      story: null,
      materials,
      origin: originCountry,
      lifecycle: null,
      image_url: null,
      is_archived: false,
      json_ld: jsonLd,
    }
    r = await tryInsert(minimal)
  }

  if (r.error) {
    const code = "code" in r.error ? String((r.error as { code?: unknown }).code ?? "") : ""
    if (code === "23505") {
      return { ok: false, message: "This SKU already exists in your catalog." }
    }
    const msg =
      "message" in r.error ? String((r.error as { message?: unknown }).message) : "Insert failed"
    return { ok: false, message: msg }
  }
  if (!r.data?.id) return { ok: false, message: "No product id returned" }
  return { ok: true, productId: r.data.id }
}
