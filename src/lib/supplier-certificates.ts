import crypto from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseProductComplianceData } from "@/lib/product-compliance-fields"
import {
  supplierCertificateExtensionForMime,
  type SupplierCertificateExtension,
} from "@/lib/supplier-certificate-upload-policy"
import {
  VERIFICATION_FIELD_KEYS,
  type VerificationFieldKey,
} from "@/lib/verification-field-keys"

export const SUPPLIER_CERTIFICATES_BUCKET = "supplier-certificates"

export { SUPPLIER_CERTIFICATE_ALLOWED_MIME } from "@/lib/supplier-certificate-upload-policy"

export type SupplierCertificateRow = {
  id: string
  field_key: string
  file_path: string
  original_filename: string
  verification_status: string
}

const BRAND_PROOF_URL_COLUMNS: Partial<
  Record<
    typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
    "production_location_proof_url" | "care_instructions_proof_url"
  >
> = {
  [VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION]: "production_location_proof_url",
  [VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS]: "care_instructions_proof_url",
}

const PRODUCT_PROOF_URL_KEYS: Partial<
  Record<
    typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
    "production_location_proof_url" | "care_instructions_proof_url"
  >
> = {
  [VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION]: "production_location_proof_url",
  [VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS]: "care_instructions_proof_url",
}

/** Display metadata only — strip path segments and control characters. */
export function sanitizeOriginalFilename(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").replace(/[\u0000-\u001f\u007f]/g, "").trim()
  return (base || "document").slice(0, 255)
}

/** Shop hostname is used as the storage root folder (e.g. originpass-sandbox.myshopify.com). */
export function normalizeShopStorageId(shop: string): string {
  return shop.trim().toLowerCase()
}

function safeFilenameStem(name: string): string {
  const stem = sanitizeOriginalFilename(name).replace(/\.[^.]+$/, "")
  const safe = stem.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return (safe || "document").slice(0, 120)
}

/** Unique, path-safe object leaf: `{uuid}-{stem}.{ext}`. */
export function buildCertificateStorageFilename(originalName: string, ext: SupplierCertificateExtension): string {
  return `${crypto.randomUUID()}-${safeFilenameStem(originalName)}.${ext}`
}

const CERTIFICATE_LEAF_PATTERN = /^[0-9a-f-]{36}(-[^/]+)?\.(pdf|png|jpe?g)$/i

/** Object paths: brand `{shop}/{fieldKey}/{file}` or product `{shop}/product/{productId}/{fieldKey}/{file}`. */
export function certificateStoragePrefix(
  shopStorageId: string,
  fieldKey: string,
  productId?: string | null,
): string {
  return productId
    ? `${shopStorageId}/product/${productId}/${fieldKey}/`
    : `${shopStorageId}/${fieldKey}/`
}

function pathMatchesPrefix(filePath: string, prefix: string): boolean {
  if (!filePath.startsWith(prefix)) return false
  const leaf = filePath.slice(prefix.length)
  return CERTIFICATE_LEAF_PATTERN.test(leaf)
}

/** Validates tenant-scoped object keys (shop-domain paths and legacy store-id paths). */
export function isCertificateObjectPathForStore(
  filePath: string,
  shopStorageId: string,
  fieldKey: string,
  productId?: string | null,
  legacyStoreId?: string | null,
): boolean {
  const prefixes = [certificateStoragePrefix(shopStorageId, fieldKey, productId)]
  if (legacyStoreId && legacyStoreId !== shopStorageId) {
    prefixes.push(certificateStoragePrefix(legacyStoreId, fieldKey, productId))
  }
  return prefixes.some((prefix) => pathMatchesPrefix(filePath, prefix))
}

export function supplierCertificatePublicUrl(supabase: SupabaseClient, filePath: string): string {
  const { data } = supabase.storage.from(SUPPLIER_CERTIFICATES_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

const PUBLIC_OBJECT_PATH_MARKERS = [
  `/storage/v1/object/public/${SUPPLIER_CERTIFICATES_BUCKET}/`,
  `/object/public/${SUPPLIER_CERTIFICATES_BUCKET}/`,
] as const

/** Map a public supplier-certificates URL (or raw object key) to its storage path. */
export function parseSupplierCertificatePublicUrl(urlOrPath: string): string | null {
  const trimmed = urlOrPath.trim()
  if (!trimmed) return null

  if (!trimmed.includes("://")) {
    return trimmed.replace(/^\/+/, "") || null
  }

  try {
    const pathname = new URL(trimmed).pathname
    for (const marker of PUBLIC_OBJECT_PATH_MARKERS) {
      const index = pathname.indexOf(marker)
      if (index === -1) continue
      const objectKey = pathname.slice(index + marker.length)
      return objectKey ? decodeURIComponent(objectKey) : null
    }
    return null
  } catch {
    return null
  }
}

/** Best-effort storage delete — logs failures and never throws. */
export async function deleteSupplierCertificateObject(
  supabase: SupabaseClient,
  pathOrUrl: string,
): Promise<void> {
  const filePath = parseSupplierCertificatePublicUrl(pathOrUrl)
  if (!filePath) {
    console.error("[supplier-certificates] cannot parse storage path:", pathOrUrl)
    return
  }

  try {
    const { error } = await supabase.storage.from(SUPPLIER_CERTIFICATES_BUCKET).remove([filePath])
    if (error) {
      console.error("[supplier-certificates] storage remove failed:", error.message, filePath)
    }
  } catch (error) {
    console.error("[supplier-certificates] storage remove threw:", error)
  }
}

type ShopifyCertificateFieldKey =
  | typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION
  | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS

async function readStoredProofUrl(
  supabase: SupabaseClient,
  input: { storeId: string; productId: string | null; proofUrlKey: "production_location_proof_url" | "care_instructions_proof_url" },
): Promise<string | null> {
  if (input.productId) {
    const { data: existing } = await supabase
      .from("products")
      .select("compliance_data")
      .eq("organization_id", input.storeId)
      .eq("id", input.productId)
      .maybeSingle()
    const compliance = parseProductComplianceData(existing?.compliance_data)
    return compliance[input.proofUrlKey] ?? null
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(`${input.proofUrlKey}`)
    .eq("id", input.storeId)
    .maybeSingle()

  const row = org as Record<string, unknown> | null
  const value = row?.[input.proofUrlKey]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** Remove product-scoped certificate row and/or orphaned proof URL storage on field revert. */
export async function cleanupProductCertificateEvidence(
  supabase: SupabaseClient,
  input: {
    storeId: string
    productId: string
    fieldKey: ShopifyCertificateFieldKey
    proofUrl?: string | null
  },
): Promise<void> {
  const { data: cert } = await supabase
    .from("certificates")
    .select("id, file_path")
    .eq("store_id", input.storeId)
    .eq("product_id", input.productId)
    .eq("field_key", input.fieldKey)
    .maybeSingle()

  if (cert) {
    await deleteSupplierCertificateObject(supabase, cert.file_path)
    const { error } = await supabase.from("certificates").delete().eq("id", cert.id)
    if (error) {
      console.error("[supplier-certificates] certificate row delete failed:", error.message)
    }
    return
  }

  if (input.proofUrl) {
    await deleteSupplierCertificateObject(supabase, input.proofUrl)
  }
}

/** @deprecated Prefer supplierCertificatePublicUrl — bucket is public-readable. */
export async function createSupplierCertificateSignedUrl(
  supabase: SupabaseClient,
  filePath: string,
): Promise<string | null> {
  return supplierCertificatePublicUrl(supabase, filePath)
}

/** Mirror the public asset URL onto brand org columns or product compliance_data overrides. */
export async function syncCertificateProofUrlToConfig(
  supabase: SupabaseClient,
  input: {
    storeId: string
    productId: string | null
    fieldKey: VerificationFieldKey
    publicUrl: string | null
  },
): Promise<void> {
  const columnOrKey =
    input.fieldKey === VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION ||
    input.fieldKey === VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS
      ? input.productId
        ? PRODUCT_PROOF_URL_KEYS[input.fieldKey]
        : BRAND_PROOF_URL_COLUMNS[input.fieldKey]
      : null

  if (!columnOrKey) return

  const previousProofUrl = await readStoredProofUrl(supabase, {
    storeId: input.storeId,
    productId: input.productId,
    proofUrlKey: columnOrKey,
  })

  if (
    previousProofUrl &&
    (input.publicUrl === null || input.publicUrl !== previousProofUrl)
  ) {
    await deleteSupplierCertificateObject(supabase, previousProofUrl)
  }

  if (input.productId) {
    const { data: existing } = await supabase
      .from("products")
      .select("compliance_data")
      .eq("organization_id", input.storeId)
      .eq("id", input.productId)
      .maybeSingle()

    const compliance = parseProductComplianceData(existing?.compliance_data)
    if (columnOrKey === "production_location_proof_url") {
      compliance.production_location_proof_url = input.publicUrl
    } else {
      compliance.care_instructions_proof_url = input.publicUrl
    }

    await supabase
      .from("products")
      .update({ compliance_data: compliance })
      .eq("organization_id", input.storeId)
      .eq("id", input.productId)
    return
  }

  await supabase
    .from("organizations")
    .update({ [columnOrKey]: input.publicUrl })
    .eq("id", input.storeId)
}

/** Remove the certificate row; storage delete is best-effort and never blocks the row delete. */
export async function deleteSupplierCertificate(
  supabase: SupabaseClient,
  cert: Pick<SupplierCertificateRow, "id" | "file_path">,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await deleteSupplierCertificateObject(supabase, cert.file_path)

  const { error: rowError } = await supabase.from("certificates").delete().eq("id", cert.id)
  if (rowError) {
    console.error("[supplier-certificates] row delete failed:", rowError.message)
    return { ok: false, message: rowError.message }
  }

  return { ok: true }
}

export function extensionForUploadedCertificate(file: Pick<File, "type" | "name">): SupplierCertificateExtension | null {
  const fromMime = supplierCertificateExtensionForMime(file.type)
  if (fromMime) return fromMime
  const lower = file.name.toLowerCase()
  if (lower.endsWith(".pdf")) return "pdf"
  if (lower.endsWith(".png")) return "png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg"
  return null
}
