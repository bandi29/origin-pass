import crypto from "node:crypto"
import { createServerSupabaseClient } from "@/lib/supabase"

/**
 * Shopify → OriginPass catalog sync (webhook + manual pipeline).
 *
 * Maps onto the tenant model:
 *   shop                → organizations  (resolved by shop_domain)
 *   Shopify Product      → products       (`external_product_id` = Shopify numeric product id)
 *   Shopify Variant      → passports      (`external_variant_id` = Shopify numeric variant id)
 *
 * Idempotency anchor: `external_product_id` (aka shopify_product_id in merchant docs).
 * Verified merchant data (compliance_data, passport fields, certificate proof URLs in
 * compliance_data / verification tables) is NEVER overwritten by sync — only volatile
 * Shopify-owned fields refresh (title, thumbnail, sku, inventory snapshot in metadata).
 */

/** Matches Shopify Admin GraphQL / REST page batch size. */
export const SHOPIFY_SYNC_BATCH_SIZE = 50

type ShopifyVariant = { id?: number | string; sku?: string | null; title?: string | null }
type ShopifyProductPayload = {
  id?: number | string
  title?: string | null
  image?: { src?: string | null } | null
  images?: Array<{ src?: string | null }> | null
  variants?: ShopifyVariant[] | null
}

export type SyncResult = { ok: boolean; reason?: string }

/** Columns safe to refresh from Shopify on every sync pass. */
export type ShopifyVolatileProductPatch = {
  name: string
  image_url: string | null
  sku: string | null
  is_archived: false
  metadata?: { shopify: { inventory_count: number } }
}

export type BulkProductInput = {
  /** Shopify numeric product id (`external_product_id` / shopify_product_id). */
  id: string
  title: string | null
  imageUrl: string | null
  /** Primary variant SKU when present — volatile catalog field. */
  sku: string | null
  /** Sum of variant inventory quantities — stored under metadata.shopify.inventory_count on insert. */
  inventoryCount: number | null
  variants: Array<{ id: string; sku?: string | null; inventoryQuantity?: number | null }>
}

export type BulkSyncResult = { ok: boolean; synced: number; reason?: string }

export type ArchiveDelistedResult = { ok: boolean; archived: number; reason?: string }

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function normalizeProductTitle(title: string | null | undefined): string {
  return (title ?? "").trim() || "Untitled product"
}

function primaryVariantSku(variants: BulkProductInput["variants"]): string | null {
  for (const variant of variants) {
    const sku = variant.sku?.trim()
    if (sku) return sku
  }
  return null
}

/** Build the volatile patch applied to existing rows — never touches compliance / passport fields. */
export function buildVolatileProductPatch(input: BulkProductInput): ShopifyVolatileProductPatch {
  const patch: ShopifyVolatileProductPatch = {
    name: normalizeProductTitle(input.title),
    image_url: input.imageUrl ?? null,
    sku: input.sku ?? primaryVariantSku(input.variants),
    is_archived: false,
  }
  if (input.inventoryCount != null && Number.isFinite(input.inventoryCount)) {
    patch.metadata = { shopify: { inventory_count: Math.max(0, Math.floor(input.inventoryCount)) } }
  }
  return patch
}

/** Resolve the OriginPass organization id for a shop domain. */
async function resolveStoreId(shop: string): Promise<string | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("shop_domain", shop)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** Upsert one product row by `external_product_id`, refreshing volatile fields only. */
export async function upsertShopifyProduct(shop: string, payload: ShopifyProductPayload): Promise<SyncResult> {
  if (payload?.id == null) return { ok: false, reason: "missing_product_id" }
  const orgId = await resolveStoreId(shop)
  if (!orgId) return { ok: false, reason: "store_not_found" }

  const supabase = createServerSupabaseClient()
  const externalProductId = String(payload.id)
  const volatile = buildVolatileProductPatch({
    id: externalProductId,
    title: payload.title ?? null,
    imageUrl: payload.image?.src ?? payload.images?.[0]?.src ?? null,
    sku: null,
    inventoryCount: null,
    variants: (Array.isArray(payload.variants) ? payload.variants : [])
      .filter((v) => v?.id != null)
      .map((v) => ({ id: String(v.id), sku: v.sku ?? null })),
  })

  let productId: string | null = null
  const { data: existingProduct } = await supabase
    .from("products")
    .select("id")
    .eq("organization_id", orgId)
    .eq("external_product_id", externalProductId)
    .maybeSingle()

  if (existingProduct?.id) {
    productId = existingProduct.id
    const { error } = await supabase
      .from("products")
      .update({
        name: volatile.name,
        image_url: volatile.image_url,
        sku: volatile.sku,
        is_archived: false,
      })
      .eq("id", productId)
    if (error) {
      console.error("[shopify-sync] product volatile update failed:", error.message)
      return { ok: false, reason: "product_update_failed" }
    }
  } else {
    const insertRow: Record<string, unknown> = {
      organization_id: orgId,
      external_product_id: externalProductId,
      external_source: "shopify",
      name: volatile.name,
      image_url: volatile.image_url,
      sku: volatile.sku,
      is_archived: false,
    }
    if (volatile.metadata) insertRow.metadata = volatile.metadata

    const { data: inserted, error } = await supabase
      .from("products")
      .insert(insertRow)
      .select("id")
      .single()
    if (error || !inserted) {
      console.error("[shopify-sync] product insert failed:", error?.message ?? "unknown")
      return { ok: false, reason: "product_insert_failed" }
    }
    productId = inserted.id
  }

  const variants = (Array.isArray(payload.variants) ? payload.variants : []).filter((v) => v?.id != null)
  if (productId && variants.length) {
    const variantIds = variants.map((v) => String(v.id))
    const { data: existing } = await supabase
      .from("passports")
      .select("external_variant_id")
      .eq("organization_id", orgId)
      .in("external_variant_id", variantIds)

    const have = new Set(((existing ?? []) as Array<{ external_variant_id: string | null }>).map((p) => p.external_variant_id))

    const seen = new Set<string>()
    const toInsert = variants
      .filter((v) => {
        const id = String(v.id)
        return !have.has(id) && !seen.has(id) && seen.add(id)
      })
      .map((v) => ({
        organization_id: orgId,
        product_id: productId,
        external_variant_id: String(v.id),
        passport_uid: crypto.randomUUID(),
        serial_number: `SHP-${v.id}`,
      }))

    if (toInsert.length) {
      const { error: passportError } = await supabase.from("passports").insert(toInsert)
      if (passportError) {
        console.error("[shopify-sync] passport insert failed:", passportError.message)
        return { ok: false, reason: "passport_insert_failed" }
      }
    }
  }

  return { ok: true }
}

/**
 * Batched catalog upsert for manual sync (~50 products per Shopify page).
 *
 * 1. Resolve existing rows by `external_product_id` (shopify_product_id).
 * 2. Bulk insert new products with Shopify defaults only.
 * 3. Upsert volatile fields on existing rows keyed by PK `id` — compliance_data untouched.
 * 4. Append missing variant → passport rows (never delete passports).
 */
export async function bulkUpsertShopifyProducts(
  shop: string,
  products: BulkProductInput[],
): Promise<BulkSyncResult> {
  if (!products.length) return { ok: true, synced: 0 }
  const orgId = await resolveStoreId(shop)
  if (!orgId) return { ok: false, synced: 0, reason: "store_not_found" }

  const supabase = createServerSupabaseClient()
  const externalIds = products.map((p) => p.id)

  const { data: existingRows, error: readError } = await supabase
    .from("products")
    .select("id, external_product_id")
    .eq("organization_id", orgId)
    .in("external_product_id", externalIds)

  if (readError) {
    console.error("[shopify-sync] bulk product lookup failed:", readError.message)
    return { ok: false, synced: 0, reason: "product_lookup_failed" }
  }

  const idByExternal = new Map<string, string>()
  const preExisting = new Set<string>()
  for (const row of (existingRows ?? []) as Array<{ id: string; external_product_id: string }>) {
    if (!row.external_product_id) continue
    idByExternal.set(row.external_product_id, row.id)
    preExisting.add(row.external_product_id)
  }

  const newProducts = products.filter((p) => !preExisting.has(p.id))
  for (const batch of chunk(newProducts, SHOPIFY_SYNC_BATCH_SIZE)) {
    const insertRows = batch.map((p) => {
      const volatile = buildVolatileProductPatch(p)
      const row: Record<string, unknown> = {
        organization_id: orgId,
        external_product_id: p.id,
        external_source: "shopify",
        name: volatile.name,
        image_url: volatile.image_url,
        sku: volatile.sku,
        is_archived: false,
      }
      if (volatile.metadata) row.metadata = volatile.metadata
      return row
    })

    const { data: inserted, error } = await supabase
      .from("products")
      .insert(insertRows)
      .select("id, external_product_id")

    if (error) {
      console.error("[shopify-sync] bulk product insert failed:", error.message)
      return { ok: false, synced: 0, reason: "product_insert_failed" }
    }
    for (const row of (inserted ?? []) as Array<{ id: string; external_product_id: string }>) {
      idByExternal.set(row.external_product_id, row.id)
    }
  }

  const existingBatch = products.filter((p) => preExisting.has(p.id))
  for (const batch of chunk(existingBatch, SHOPIFY_SYNC_BATCH_SIZE)) {
    const upsertRows = batch
      .map((p) => {
        const id = idByExternal.get(p.id)
        if (!id) return null
        const volatile = buildVolatileProductPatch(p)
        return {
          id,
          name: volatile.name,
          image_url: volatile.image_url,
          sku: volatile.sku,
          is_archived: false as const,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    if (!upsertRows.length) continue

    const { error } = await supabase.from("products").upsert(upsertRows, { onConflict: "id" })
    if (error) {
      console.error("[shopify-sync] bulk volatile upsert failed:", error.message)
      return { ok: false, synced: 0, reason: "product_update_failed" }
    }
  }

  const allVariants: Array<{ variantId: string; productId: string }> = []
  for (const product of products) {
    const productId = idByExternal.get(product.id)
    if (!productId) continue
    for (const variant of product.variants) {
      if (variant?.id) allVariants.push({ variantId: variant.id, productId })
    }
  }

  if (allVariants.length) {
    for (const variantBatch of chunk(allVariants, SHOPIFY_SYNC_BATCH_SIZE)) {
      const variantIds = variantBatch.map((v) => v.variantId)
      const { data: existingPassports } = await supabase
        .from("passports")
        .select("external_variant_id")
        .eq("organization_id", orgId)
        .in("external_variant_id", variantIds)

      const have = new Set(
        ((existingPassports ?? []) as Array<{ external_variant_id: string | null }>).map(
          (p) => p.external_variant_id,
        ),
      )

      const seen = new Set<string>()
      const toInsert = variantBatch
        .filter((v) => !have.has(v.variantId) && !seen.has(v.variantId) && seen.add(v.variantId))
        .map((v) => ({
          organization_id: orgId,
          product_id: v.productId,
          external_variant_id: v.variantId,
          passport_uid: crypto.randomUUID(),
          serial_number: `SHP-${v.variantId}`,
        }))

      if (toInsert.length) {
        const { error } = await supabase.from("passports").insert(toInsert)
        if (error) console.error("[shopify-sync] bulk passport insert failed:", error.message)
      }
    }
  }

  return { ok: true, synced: products.length }
}

/**
 * Soft-archive Shopify-linked products missing from the latest full-catalog payload.
 * Never DELETE — printed QR / passport rows remain resolvable.
 */
export async function archiveDelistedShopifyProducts(
  orgId: string,
  activeExternalProductIds: ReadonlySet<string>,
): Promise<ArchiveDelistedResult> {
  const supabase = createServerSupabaseClient()
  const { data: rows, error } = await supabase
    .from("products")
    .select("id, external_product_id")
    .eq("organization_id", orgId)
    .eq("external_source", "shopify")
    .eq("is_archived", false)
    .not("external_product_id", "is", null)

  if (error) {
    console.error("[shopify-sync] delisted lookup failed:", error.message)
    return { ok: false, archived: 0, reason: "delisted_lookup_failed" }
  }

  const toArchive = ((rows ?? []) as Array<{ id: string; external_product_id: string | null }>).filter(
    (row) => row.external_product_id && !activeExternalProductIds.has(row.external_product_id),
  )

  if (!toArchive.length) return { ok: true, archived: 0 }

  let archived = 0
  for (const batch of chunk(toArchive, SHOPIFY_SYNC_BATCH_SIZE)) {
    const ids = batch.map((r) => r.id)
    const { error: updateError } = await supabase
      .from("products")
      .update({ is_archived: true })
      .in("id", ids)
    if (updateError) {
      console.error("[shopify-sync] delisted archive failed:", updateError.message)
      return { ok: false, archived, reason: "delisted_archive_failed" }
    }
    archived += ids.length
  }

  return { ok: true, archived }
}

/** products/delete → soft-archive (preserve passports + scan history). */
export async function archiveShopifyProduct(shop: string, productId: number | string): Promise<SyncResult> {
  const orgId = await resolveStoreId(shop)
  if (!orgId) return { ok: false, reason: "store_not_found" }
  const supabase = createServerSupabaseClient()
  await supabase
    .from("products")
    .update({ is_archived: true })
    .eq("organization_id", orgId)
    .eq("external_product_id", String(productId))
  return { ok: true }
}

/** app/uninstalled → revoke token and mark store uninstalled (delegates to compliance handler). */
export async function clearShopifyToken(shop: string): Promise<SyncResult> {
  const { handleShopifyAppUninstalled } = await import("@/lib/shopify-compliance")
  const result = await handleShopifyAppUninstalled(shop, null)
  return { ok: result.ok, reason: result.reason }
}
