import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import {
  SUPPLIER_CERTIFICATE_SIZE_ERROR,
  SUPPLIER_CERTIFICATE_TYPE_ERROR,
  SUPPLIER_CERTIFICATE_MAX_BYTES,
} from "@/lib/supplier-certificate-upload-policy"
import {
  SUPPLIER_CERTIFICATES_BUCKET,
  buildCertificateStorageFilename,
  certificateStoragePrefix,
  deleteSupplierCertificate,
  extensionForUploadedCertificate,
  isCertificateObjectPathForStore,
  normalizeShopStorageId,
  sanitizeOriginalFilename,
  supplierCertificatePublicUrl,
  syncCertificateProofUrlToConfig,
  type SupplierCertificateRow,
} from "@/lib/supplier-certificates"
import {
  isShopifyCertificateUiField,
  verificationFieldKeyForUi,
} from "@/lib/verification-field-keys"
import { isValidShopDomain, verifyShopifySessionToken } from "@/lib/shopify"
import { TIER_LIMITS, getSubscriptionTier } from "@/lib/shopify-billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readToken(request: NextRequest, fallback: string | null): string | null {
  const header = request.headers.get("authorization") ?? ""
  if (header.startsWith("Bearer ")) return header.slice(7)
  return fallback
}

function resolveShop(token: string | null, shopParam: string | null): string | null {
  const verified = verifyShopifySessionToken(token)
  if (token && !verified) return null
  const shop = verified?.shop ?? (process.env.NODE_ENV === "production" ? "" : shopParam ?? "")
  return isValidShopDomain(shop) ? shop : null
}

async function resolveStoreId(shop: string): Promise<string | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("shop_domain", shop)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function resolveProductForStore(storeId: string, productId: string | null): Promise<string | null> {
  if (!productId) return null
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("products")
    .select("id")
    .eq("organization_id", storeId)
    .eq("id", productId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

async function findCert(
  storeId: string,
  fieldKey: string,
  productId: string | null,
): Promise<SupplierCertificateRow | null> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("certificates")
    .select("id, field_key, file_path, original_filename, verification_status")
    .eq("store_id", storeId)
    .eq("field_key", fieldKey)

  query = productId ? query.eq("product_id", productId) : query.is("product_id", null)

  const { data } = await query.maybeSingle()
  return (data as SupplierCertificateRow | null) ?? null
}

function parseProductId(raw: string | null): string | null {
  if (!raw?.trim()) return null
  return /^[0-9a-f-]{36}$/i.test(raw.trim()) ? raw.trim() : null
}

/** GET — display metadata + public asset URL. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const field = params.get("field")
  if (!isShopifyCertificateUiField(field)) {
    return NextResponse.json({ ok: false, message: "Unknown document field." }, { status: 400 })
  }

  const shop = resolveShop(readToken(request, null), params.get("shop"))
  if (!shop) return NextResponse.json({ ok: false, message: "Session expired." }, { status: 401 })

  const storeId = await resolveStoreId(shop)
  if (!storeId) return NextResponse.json({ ok: true, exists: false })

  const productId = parseProductId(params.get("productId"))
  if (productId) {
    const owned = await resolveProductForStore(storeId, productId)
    if (!owned) return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 })
  }

  const fieldKey = verificationFieldKeyForUi(field)
  const cert = await findCert(storeId, fieldKey, productId)
  if (!cert) return NextResponse.json({ ok: true, exists: false })

  const shopStorageId = normalizeShopStorageId(shop)
  if (!isCertificateObjectPathForStore(cert.file_path, shopStorageId, fieldKey, productId, storeId)) {
    console.error("[shopify/certificates] invalid stored path for store:", cert.id)
    return NextResponse.json({ ok: false, message: "Certificate record is invalid." }, { status: 500 })
  }

  const supabase = createServerSupabaseClient()
  const publicUrl = supplierCertificatePublicUrl(supabase, cert.file_path)
  return NextResponse.json({
    ok: true,
    exists: true,
    fileName: cert.original_filename,
    status: cert.verification_status,
    scope: productId ? ("product" as const) : ("brand" as const),
    publicUrl,
    signedUrl: publicUrl,
  })
}

/** POST — validate, upload to public bucket, replace prior cert atomically, insert row. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed upload." }, { status: 400 })
  }

  const field = form.get("field")
  if (!isShopifyCertificateUiField(field)) {
    return NextResponse.json({ ok: false, message: "Unknown document field." }, { status: 400 })
  }

  const formToken = typeof form.get("sessionToken") === "string" ? (form.get("sessionToken") as string) : null
  const shopParam = typeof form.get("shop") === "string" ? (form.get("shop") as string) : null
  const shop = resolveShop(readToken(request, formToken), shopParam)
  if (!shop) {
    return NextResponse.json({ ok: false, message: "Session expired — reopen the app and retry." }, { status: 401 })
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, message: "No file received." }, { status: 400 })
  }
  const ext = extensionForUploadedCertificate(file)
  if (!ext) {
    return NextResponse.json({ ok: false, message: SUPPLIER_CERTIFICATE_TYPE_ERROR }, { status: 415 })
  }
  if (file.size > SUPPLIER_CERTIFICATE_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: SUPPLIER_CERTIFICATE_SIZE_ERROR }, { status: 413 })
  }

  const storeId = await resolveStoreId(shop)
  if (!storeId) {
    return NextResponse.json({ ok: false, message: "Store not found. Connect the store first." }, { status: 404 })
  }

  // Tier gate (server-side — the UI banner alone is not enforcement): evidence
  // hosting starts on the Grower plan.
  const tier = await getSubscriptionTier(shop)
  if (!TIER_LIMITS[tier].evidenceUploads) {
    return NextResponse.json(
      { ok: false, message: "Supplier verification uploads are available on the Grower plan ($29/mo). Upgrade to attach evidence." },
      { status: 403 },
    )
  }

  const rawProductId = typeof form.get("productId") === "string" ? (form.get("productId") as string) : null
  const productId = parseProductId(rawProductId)
  if (rawProductId && !productId) {
    return NextResponse.json({ ok: false, message: "Invalid product." }, { status: 400 })
  }
  if (productId) {
    const owned = await resolveProductForStore(storeId, productId)
    if (!owned) return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 })
  }

  const supabase = createServerSupabaseClient()
  const fieldKey = verificationFieldKeyForUi(field)
  const shopStorageId = normalizeShopStorageId(shop)
  const originalFilename = sanitizeOriginalFilename(file.name)
  const path = `${certificateStoragePrefix(shopStorageId, fieldKey, productId)}${buildCertificateStorageFilename(originalFilename, ext)}`

  if (!isCertificateObjectPathForStore(path, shopStorageId, fieldKey, productId, storeId)) {
    return NextResponse.json({ ok: false, message: "Invalid storage path." }, { status: 500 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType =
      file.type && file.type !== "application/octet-stream"
        ? file.type
        : ext === "pdf"
          ? "application/pdf"
          : ext === "png"
            ? "image/png"
            : "image/jpeg"

    const { error: uploadError } = await supabase.storage
      .from(SUPPLIER_CERTIFICATES_BUCKET)
      .upload(path, buffer, { contentType, upsert: false, cacheControl: "public, max-age=3600" })
    if (uploadError) {
      console.error("[shopify/certificates] upload failed:", uploadError.message)
      return NextResponse.json({ ok: false, message: "Upload failed. Please try again." }, { status: 502 })
    }

    const previous = await findCert(storeId, fieldKey, productId)
    if (previous) {
      const removed = await deleteSupplierCertificate(supabase, previous)
      if (!removed.ok) {
        await supabase.storage.from(SUPPLIER_CERTIFICATES_BUCKET).remove([path])
        return NextResponse.json({ ok: false, message: "Could not replace the existing document." }, { status: 500 })
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("certificates")
      .insert({
        store_id: storeId,
        product_id: productId,
        field_key: fieldKey,
        file_path: path,
        original_filename: originalFilename,
        mime_type: contentType,
        file_size: file.size,
      })
      .select("id, verification_status")
      .single()

    if (insertError || !inserted) {
      console.error("[shopify/certificates] row insert failed:", insertError?.message ?? "unknown")
      await supabase.storage.from(SUPPLIER_CERTIFICATES_BUCKET).remove([path])
      return NextResponse.json({ ok: false, message: "Could not save the document. Try again." }, { status: 500 })
    }

    const publicUrl = supplierCertificatePublicUrl(supabase, path)
    await syncCertificateProofUrlToConfig(supabase, {
      storeId,
      productId,
      fieldKey,
      publicUrl,
    })

    return NextResponse.json({
      ok: true,
      fileName: originalFilename,
      status: (inserted as { verification_status: string }).verification_status,
      scope: productId ? ("product" as const) : ("brand" as const),
      publicUrl,
      signedUrl: publicUrl,
    })
  } catch (error) {
    console.error("[shopify/certificates] unexpected error:", error)
    return NextResponse.json({ ok: false, message: "Upload interrupted. Please try again." }, { status: 500 })
  }
}

/** DELETE — remove storage object and database row (no orphans). */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const field = params.get("field")
  if (!isShopifyCertificateUiField(field)) {
    return NextResponse.json({ ok: false, message: "Unknown document field." }, { status: 400 })
  }

  const shop = resolveShop(readToken(request, null), params.get("shop"))
  if (!shop) return NextResponse.json({ ok: false, message: "Session expired." }, { status: 401 })

  const storeId = await resolveStoreId(shop)
  if (!storeId) return NextResponse.json({ ok: false, message: "Store not found." }, { status: 404 })

  const productId = parseProductId(params.get("productId"))
  if (productId) {
    const owned = await resolveProductForStore(storeId, productId)
    if (!owned) return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 })
  }

  const fieldKey = verificationFieldKeyForUi(field)
  const cert = await findCert(storeId, fieldKey, productId)
  if (!cert) return NextResponse.json({ ok: true })

  const shopStorageId = normalizeShopStorageId(shop)
  if (!isCertificateObjectPathForStore(cert.file_path, shopStorageId, fieldKey, productId, storeId)) {
    console.error("[shopify/certificates] refusing delete — path outside store prefix:", cert.id)
    return NextResponse.json({ ok: false, message: "Certificate record is invalid." }, { status: 500 })
  }

  const supabase = createServerSupabaseClient()
  const removed = await deleteSupplierCertificate(supabase, cert)
  if (!removed.ok) {
    return NextResponse.json({ ok: false, message: "Could not remove the document." }, { status: 500 })
  }

  await syncCertificateProofUrlToConfig(supabase, {
    storeId,
    productId,
    fieldKey,
    publicUrl: null,
  })

  return NextResponse.json({ ok: true })
}
