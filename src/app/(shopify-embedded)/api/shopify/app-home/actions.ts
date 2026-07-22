"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import { checkRateLimitAsync } from "@/lib/rate-limit"
import { isValidShopDomain, verifyShopifySessionToken } from "@/lib/shopify"
import {
  beginSharedSyncProgress,
  finishSharedSyncProgress,
  readSharedSyncProgress,
  type ShopifySyncProgress,
} from "@/lib/shopify-catalog-sync-progress"
import { enqueueCatalogSync, hasCatalogSyncQueue } from "@/lib/shopify-catalog-sync-queue"
import { fetchShopifyCatalogCount } from "@/lib/shopify-catalog-sync"
import { HEAVY_VOLUME_THRESHOLD, processCatalogSyncJob } from "@/lib/shopify-catalog-sync-job"
import { buildShopifyPublicPassportUrl } from "@/lib/shopify-public-passport-url"
import { fieldClaimProvenance, parseProductComplianceData, readProductComplianceField } from "@/lib/product-compliance-fields"
import { VERIFICATION_FIELD_KEYS } from "@/lib/verification-field-keys"
import {
  fieldInheritsBrandDefault,
  normalizedProductFieldStorageValue,
  resolveFieldLineageState,
  type FieldLineageState,
  type ProductFieldLineage,
} from "@/lib/field-lineage"
import { cleanupProductCertificateEvidence } from "@/lib/supplier-certificates"
import { normalizeTier, type SubscriptionTier } from "@/lib/shopify-billing"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"

export type StoreConfigState = StoreConfigData & {
  ok: boolean
  message: string
}

export type SyncProductsState = {
  ok: boolean
  message: string
  /** "inline" = completed within this call; "background" = queued, poll progress. */
  mode?: "inline" | "background"
  /** BullMQ job id when the sync was accepted into the queue. */
  jobId?: string
  /** True when an inline run hit the no-infrastructure cap on a heavy catalog. */
  capped?: boolean
}

export type SyncProductsProgressState = ShopifySyncProgress

export type StoreConfigData = {
  productionLocation: string
  careInstructions: string
}

export type PrintableProduct = {
  id: string
  title: string
  sku: string | null
  /** Absolute public passport URL encoded into the printed QR. */
  url: string
  /** Shopify featured image synced into `products.image_url`. */
  imageUrl: string | null
  /** Per-field inheritance lineage for merchant audit visibility. */
  lineage: ProductFieldLineage
  /** Warehouse print quantity — each unit renders as its own sticker. */
  quantity?: number
}

export type ProductPassportEditorData = {
  id: string
  title: string
  sku: string | null
  imageUrl: string | null
  productionLocation: string
  careInstructions: string
  brandProductionLocation: string
  brandCareInstructions: string
  productionProvenance: "record" | "fallback"
  careProvenance: "record" | "fallback"
  productionLineage: FieldLineageState
  careLineage: FieldLineageState
  brandCertProduction: boolean
  brandCertCare: boolean
  hasProductCertProduction: boolean
  hasProductCertCare: boolean
}

export type ProductPassportSaveState = {
  ok: boolean
  message: string
  productionLocation: string
  careInstructions: string
}

type ProductRow = {
  id: string
  name: string | null
  sku: string | null
  external_product_id: string | null
  image_url: string | null
  materials: string | null
  story: string | null
  compliance_data: Record<string, unknown> | null
  traceability_data: Record<string, unknown> | null
}

/**
 * Resolve the authoritative shop for an action: the verified App Bridge session
 * token wins; in production a missing/invalid token fails; dev falls back to the
 * client-supplied param so `shopify app dev` works. Mirrors `updateStoreConfig`.
 */
function resolveActionShop(shop: string, sessionToken?: string): string | null {
  const verified = verifyShopifySessionToken(sessionToken)
  if (sessionToken && !verified) return null
  const resolved = (verified?.shop ?? (process.env.NODE_ENV === "production" ? "" : shop)).trim()
  return isValidShopDomain(resolved) ? resolved : null
}

async function loadCertificatePresence(
  storeId: string,
): Promise<{
  brand: Set<string>
  product: Map<string, Set<string>>
}> {
  const supabase = createServerSupabaseClient()
  const brand = new Set<string>()
  const product = new Map<string, Set<string>>()

  const { data: rows } = await supabase
    .from("certificates")
    .select("field_key, product_id")
    .eq("store_id", storeId)
    .in("field_key", [VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION, VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS])

  for (const row of (rows ?? []) as Array<{ field_key: string; product_id: string | null }>) {
    if (row.product_id) {
      const set = product.get(row.product_id) ?? new Set<string>()
      set.add(row.field_key)
      product.set(row.product_id, set)
    } else {
      brand.add(row.field_key)
    }
  }

  return { brand, product }
}

function fieldLineageState(
  fieldKey: typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
  complianceData: unknown,
  brandDefault: string,
  productCerts: Set<string> | undefined,
  brandCerts: Set<string>,
): FieldLineageState {
  const productValue = readProductComplianceField(complianceData, fieldKey)
  return resolveFieldLineageState({
    productValue,
    brandDefault,
    productCertPresent: Boolean(productCerts?.has(fieldKey)),
    brandCertPresent: brandCerts.has(fieldKey),
  })
}

export type ProductListPage = {
  products: PrintableProduct[]
  /** Total matching rows in the catalog (for "Showing X of Y" + Load more). */
  totalCount: number
}

/** Page size for the embedded catalog list. ("use server" modules may only
 * export async functions, so this stays module-private.) */
const PRODUCT_LIST_PAGE_SIZE = 100

/** Strip PostgREST `.or()` metacharacters so user search can't alter the filter. */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()%\\]/g, " ").trim().slice(0, 80)
}

/**
 * List the store's products that have a public passport URL (Shopify-synced
 * products carry `external_product_id`), with server-side search + pagination.
 * Auth: verified session token in production (see resolveActionShop).
 * Returns an empty page on any failure so the UI degrades gracefully.
 */
export async function listStoreProducts(
  shopParam: string,
  opts: { sessionToken?: string; search?: string; offset?: number } = {},
): Promise<ProductListPage> {
  const empty: ProductListPage = { products: [], totalCount: 0 }
  const shop = resolveActionShop(shopParam, opts.sessionToken)
  if (!shop) return empty

  try {
    const supabase = createServerSupabaseClient()
    const { data: store } = await supabase
      .from("organizations")
      .select("id, global_production_location, global_care_instructions")
      .eq("shop_domain", shop)
      .maybeSingle()
    if (!store?.id) return empty

    const offset = Math.max(0, Math.floor(opts.offset ?? 0))
    const term = sanitizeSearchTerm(opts.search ?? "")

    let query = supabase
      .from("products")
      .select("id, name, sku, external_product_id, image_url, compliance_data", { count: "exact" })
      .eq("organization_id", store.id)
      .eq("is_archived", false)
      .not("external_product_id", "is", null)

    if (term) {
      query = query.or(`name.ilike.*${term}*,sku.ilike.*${term}*`)
    }

    const [{ data: rows, count }, certPresence] = await Promise.all([
      query.order("name").range(offset, offset + PRODUCT_LIST_PAGE_SIZE - 1),
      loadCertificatePresence(store.id),
    ])
    const totalCount = count ?? 0
    const productRows = (rows ?? []) as ProductRow[]
    const brandProduction = store.global_production_location?.trim() ?? ""
    const brandCare = store.global_care_instructions?.trim() ?? ""

    const products = productRows.map((p) => {
      const productCerts = certPresence.product.get(p.id)
      const brandCerts = {
        productionLocation: certPresence.brand.has(VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION),
        careInstructions: certPresence.brand.has(VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS),
      }
      const productionLocation = fieldLineageState(
        VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
        p.compliance_data,
        brandProduction,
        productCerts,
        certPresence.brand,
      )
      const careInstructions = fieldLineageState(
        VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
        p.compliance_data,
        brandCare,
        productCerts,
        certPresence.brand,
      )

      return {
        id: p.id,
        title: p.name?.trim() || "Untitled product",
        sku: p.sku,
        url: buildShopifyPublicPassportUrl(shop, p.external_product_id ?? ""),
        imageUrl: p.image_url?.trim() || null,
        lineage: {
          productionLocation,
          careInstructions,
          brandCerts,
        },
      }
    })

    return { products, totalCount }
  } catch {
    return empty
  }
}

export type StoreConfigWithFreshness = StoreConfigData & {
  /** ISO timestamp of the last catalog sync that committed data, or null. */
  lastSyncedAt: string | null
  /** Billing tier — drives evidence-upload and sync-volume gating in the UI. */
  subscriptionTier: SubscriptionTier
}

/** Load persisted fallback config for the Shopify store (organizations row). */
export async function getStoreConfig(shopParam: string, sessionToken?: string): Promise<StoreConfigWithFreshness> {
  const empty: StoreConfigWithFreshness = {
    productionLocation: "",
    careInstructions: "",
    lastSyncedAt: null,
    subscriptionTier: "free",
  }
  const shop = resolveActionShop(shopParam, sessionToken)
  if (!shop) return empty

  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from("organizations")
      .select("global_production_location, global_care_instructions, shopify_last_synced_at, subscription_tier")
      .eq("shop_domain", shop)
      .maybeSingle()

    const row = data as {
      global_production_location?: string | null
      global_care_instructions?: string | null
      shopify_last_synced_at?: string | null
      subscription_tier?: string | null
    } | null

    return {
      productionLocation: row?.global_production_location ?? "",
      careInstructions: row?.global_care_instructions ?? "",
      lastSyncedAt: row?.shopify_last_synced_at ?? null,
      subscriptionTier: normalizeTier(row?.subscription_tier),
    }
  } catch {
    return empty
  }
}

/**
 * Server Action: persist the store's global compliance fallbacks.
 * Upserts the organizations row keyed by `shop_domain` and returns saved values.
 */
export async function updateStoreConfig(input: {
  shop: string
  /** App Bridge session token (`await shopify.idToken()`). Authoritative for auth. */
  sessionToken?: string
  productionLocation: string
  careInstructions: string
}): Promise<StoreConfigState> {
  // Server-side caps matching the UI limits — don't trust the client's maxLength.
  const productionLocation = input.productionLocation.trim().slice(0, 120)
  const careInstructions = input.careInstructions.trim().slice(0, 500)

  // Auth: the verified session token — not the client-supplied `shop` — is the
  // source of truth. A token is required in production; dev falls back to the
  // param so local `shopify app dev` without a live token still works.
  const verified = verifyShopifySessionToken(input.sessionToken)
  const shop = (verified?.shop ?? (process.env.NODE_ENV === "production" ? "" : input.shop)).trim()

  if (input.sessionToken && !verified) {
    return {
      ok: false,
      message: "Session expired — reload the app and try again.",
      productionLocation,
      careInstructions,
    }
  }

  if (!isValidShopDomain(shop)) {
    return {
      ok: false,
      message: "Missing or invalid shop — reopen the app from Shopify admin.",
      productionLocation,
      careInstructions,
    }
  }

  const supabase = createServerSupabaseClient()
  const payload = {
    shop_domain: shop,
    name: shop,
    global_production_location: productionLocation || null,
    global_care_instructions: careInstructions || null,
  }

  const { data: updated, error: updateError } = await supabase
    .from("organizations")
    .update({
      global_production_location: payload.global_production_location,
      global_care_instructions: payload.global_care_instructions,
    })
    .eq("shop_domain", shop)
    .select("global_production_location, global_care_instructions")
    .maybeSingle()

  if (updateError) {
    console.error("[shopify/app-home] config update failed:", updateError.message)
    return {
      ok: false,
      message: "Could not save settings. Please try again.",
      productionLocation,
      careInstructions,
    }
  }

  let saved = updated

  if (!saved) {
    const { data: inserted, error: insertError } = await supabase
      .from("organizations")
      .insert(payload)
      .select("global_production_location, global_care_instructions")
      .single()

    if (insertError) {
      console.error("[shopify/app-home] config insert failed:", insertError.message)
      return {
        ok: false,
        message: "Could not save settings. Please try again.",
        productionLocation,
        careInstructions,
      }
    }
    saved = inserted
  }

  return {
    ok: true,
    message: "Saved. Brand defaults apply to products that inherit these values.",
    productionLocation: saved.global_production_location ?? "",
    careInstructions: saved.global_care_instructions ?? "",
  }
}

/** Whether the store has a persisted Shopify offline access token. */
export async function isStoreConnected(shopParam: string, sessionToken?: string): Promise<boolean> {
  const shop = resolveActionShop(shopParam, sessionToken)
  if (!shop) return false
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from("organizations")
      .select("shopify_access_token")
      .eq("shop_domain", shop)
      .maybeSingle()
    return Boolean((data as { shopify_access_token?: string | null } | null)?.shopify_access_token)
  } catch {
    return false
  }
}

/** Poll the shared (Redis-backed) sync progress feed. */
export async function getShopifySyncProgress(shopParam: string, sessionToken?: string): Promise<SyncProductsProgressState> {
  const shop = resolveActionShop(shopParam, sessionToken)
  if (!shop) {
    return {
      status: "idle",
      processed: 0,
      total: null,
      percent: 0,
      message: null,
      ok: null,
      updatedAt: Date.now(),
    }
  }
  // Redis-backed read — consistent across serverless instances and the worker.
  return readSharedSyncProgress(shop)
}

/**
 * Server Action: hybrid catalog sync trigger.
 *
 * Branch A (default): boutique catalog (< HEAVY_VOLUME_THRESHOLD) or queue infra
 * not deployed → runs inline within this call and returns the completed outcome
 * (`mode: "inline"`). Heavy catalogs without infra get the controlled capped
 * variant (first 2,000 records + friendly upgrade message) instead of a 504.
 *
 * Branch B: heavy catalog AND BullMQ/Redis deployed → enqueues and returns
 * immediately (`mode: "background"`); the client polls `getShopifySyncProgress`.
 */
export async function syncStoreProducts(shopParam: string, sessionToken?: string): Promise<SyncProductsState> {
  const shop = resolveActionShop(shopParam, sessionToken)
  if (!shop) {
    return { ok: false, message: "Session expired — reopen the app from Shopify admin and retry." }
  }

  // Rate limit: syncs are expensive (Shopify API budget + DB writes). The
  // duplicate-run guard below stops concurrency; this stops rapid re-triggering.
  const rate = await checkRateLimitAsync(`shopify-sync:${shop}`, 4, 10 * 60 * 1000)
  if (!rate.ok) {
    return { ok: false, message: "Too many sync attempts — wait a few minutes and try again." }
  }

  // Actionable early error when the store was never connected.
  // (Auto-refreshing expiring offline token — never read the column directly.)
  const token = await getShopifyAdminToken(shop)
  if (!token) {
    return {
      ok: false,
      message:
        "Store not connected. Click “Connect store” above to authorize OriginPass, then try syncing again.",
    }
  }

  // Cross-instance duplicate guard; also seeds sync:progress:{shop} as running
  // so the first poll already shows "Preparing data…".
  const started = await beginSharedSyncProgress(shop, "Preparing data…")
  if (!started) {
    return { ok: false, message: "A catalog sync is already running for this store." }
  }

  try {
    // Dynamic discovery: exact real-time catalog volume (productsCount).
    const totalCount = await fetchShopifyCatalogCount(shop, token)

    // ── Branch B: heavy catalog + deployed infrastructure → background job.
    if (totalCount >= HEAVY_VOLUME_THRESHOLD && hasCatalogSyncQueue()) {
      const enqueued = await enqueueCatalogSync(shop)
      if (enqueued) {
        return { ok: true, mode: "background", message: "Catalog sync started.", jobId: enqueued.jobId }
      }
    }

    // ── Branch A: inline in-request sync (full, or capped for heavy-no-infra).
    const inlineCap = totalCount >= HEAVY_VOLUME_THRESHOLD ? HEAVY_VOLUME_THRESHOLD : undefined
    const outcome = await processCatalogSyncJob(shop, { inlineCap })
    return { ok: outcome.ok, mode: "inline", message: outcome.message, capped: outcome.capped }
  } catch (err) {
    console.error("[shopify/app-home] sync trigger failed:", err)
    const message = "Could not start the sync. Please try again."
    // Leave a terminal progress entry so pollers don't hang on "running".
    await finishSharedSyncProgress(shop, { ok: false, message, processed: 0, total: null }).catch(() => undefined)
    return { ok: false, message }
  }
}

/**
 * Load a single synced product for the per-product passport editor.
 *
 * Auth: verified session token in production (see resolveActionShop). Server
 * Actions are publicly reachable POST endpoints, so trusting the caller-supplied
 * `shop` here would let anyone read another store's compliance data.
 */
export async function getProductPassportEditor(
  shopParam: string,
  productId: string,
  sessionToken?: string,
): Promise<ProductPassportEditorData | null> {
  const shop = resolveActionShop(shopParam, sessionToken)
  if (!shop || !/^[0-9a-f-]{36}$/i.test(productId)) return null

  try {
    const supabase = createServerSupabaseClient()
    const { data: store } = await supabase
      .from("organizations")
      .select("id, global_production_location, global_care_instructions")
      .eq("shop_domain", shop)
      .maybeSingle()
    if (!store?.id) return null

    const [{ data: product }, certPresence] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, image_url, compliance_data, external_product_id")
        .eq("organization_id", store.id)
        .eq("id", productId)
        .not("external_product_id", "is", null)
        .maybeSingle(),
      loadCertificatePresence(store.id),
    ])

    if (!product) return null

    const row = product as ProductRow
    const brandProduction = store.global_production_location?.trim() ?? ""
    const brandCare = store.global_care_instructions?.trim() ?? ""
    const rawProduction =
      readProductComplianceField(row.compliance_data, VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION) ?? ""
    const rawCare =
      readProductComplianceField(row.compliance_data, VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS) ?? ""
    const productionValue = fieldInheritsBrandDefault(rawProduction, brandProduction) ? "" : rawProduction
    const careValue = fieldInheritsBrandDefault(rawCare, brandCare) ? "" : rawCare

    const productionProvenance = fieldClaimProvenance(
      VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
      row.compliance_data,
      brandProduction,
    )
    const careProvenance = fieldClaimProvenance(
      VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
      row.compliance_data,
      brandCare,
    )

    const productCerts = certPresence.product.get(productId) ?? new Set<string>()

    const brandCertProduction = certPresence.brand.has(VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION)
    const brandCertCare = certPresence.brand.has(VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS)

    return {
      id: row.id,
      title: row.name?.trim() || "Untitled product",
      sku: row.sku,
      imageUrl: row.image_url?.trim() || null,
      productionLocation: productionValue,
      careInstructions: careValue,
      brandProductionLocation: brandProduction,
      brandCareInstructions: brandCare,
      productionProvenance,
      careProvenance,
      productionLineage: resolveFieldLineageState({
        productValue: rawProduction,
        brandDefault: brandProduction,
        productCertPresent: productCerts.has(VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION),
        brandCertPresent: brandCertProduction,
      }),
      careLineage: resolveFieldLineageState({
        productValue: rawCare,
        brandDefault: brandCare,
        productCertPresent: productCerts.has(VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS),
        brandCertPresent: brandCertCare,
      }),
      brandCertProduction,
      brandCertCare,
      hasProductCertProduction: productCerts.has(VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION),
      hasProductCertCare: productCerts.has(VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS),
    }
  } catch {
    return null
  }
}

/** Persist per-product production/care values (stored in compliance_data). */
export async function updateProductPassportFields(input: {
  shop: string
  productId: string
  sessionToken?: string
  productionLocation: string
  careInstructions: string
}): Promise<ProductPassportSaveState> {
  const rawProduction = input.productionLocation.trim()
  const rawCare = input.careInstructions.trim()

  const verified = verifyShopifySessionToken(input.sessionToken)
  const shop = (verified?.shop ?? (process.env.NODE_ENV === "production" ? "" : input.shop)).trim()

  if (input.sessionToken && !verified) {
    return {
      ok: false,
      message: "Session expired — reload the app and try again.",
      productionLocation: rawProduction,
      careInstructions: rawCare,
    }
  }
  if (!isValidShopDomain(shop) || !/^[0-9a-f-]{36}$/i.test(input.productId)) {
    return { ok: false, message: "Invalid product.", productionLocation: rawProduction, careInstructions: rawCare }
  }

  const supabase = createServerSupabaseClient()
  const { data: store } = await supabase
    .from("organizations")
    .select("id, global_production_location, global_care_instructions")
    .eq("shop_domain", shop)
    .maybeSingle()
  if (!store?.id) {
    return { ok: false, message: "Store not found.", productionLocation: rawProduction, careInstructions: rawCare }
  }

  const brandProduction = store.global_production_location?.trim() ?? ""
  const brandCare = store.global_care_instructions?.trim() ?? ""
  const productionLocation = normalizedProductFieldStorageValue(rawProduction, brandProduction)
  const careInstructions = normalizedProductFieldStorageValue(rawCare, brandCare)

  const { data: existing } = await supabase
    .from("products")
    .select("compliance_data")
    .eq("organization_id", store.id)
    .eq("id", input.productId)
    .maybeSingle()

  if (!existing) {
    return { ok: false, message: "Product not found.", productionLocation, careInstructions }
  }

  const compliance = parseProductComplianceData(existing.compliance_data)
  const prevProductionOverridden = !fieldInheritsBrandDefault(
    compliance.production_location,
    brandProduction,
  )
  const prevCareOverridden = !fieldInheritsBrandDefault(compliance.care_instructions, brandCare)
  const nextProductionOverridden = Boolean(productionLocation)
  const nextCareOverridden = Boolean(careInstructions)

  compliance.production_location = productionLocation || null
  compliance.care_instructions = careInstructions || null

  if (prevProductionOverridden && !nextProductionOverridden) {
    await cleanupProductCertificateEvidence(supabase, {
      storeId: store.id,
      productId: input.productId,
      fieldKey: VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
      proofUrl: compliance.production_location_proof_url,
    })
    compliance.production_location_proof_url = null
  }

  if (prevCareOverridden && !nextCareOverridden) {
    await cleanupProductCertificateEvidence(supabase, {
      storeId: store.id,
      productId: input.productId,
      fieldKey: VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
      proofUrl: compliance.care_instructions_proof_url,
    })
    compliance.care_instructions_proof_url = null
  }

  const { error } = await supabase
    .from("products")
    .update({ compliance_data: compliance })
    .eq("organization_id", store.id)
    .eq("id", input.productId)

  if (error) {
    console.error("[shopify/product-editor] update failed:", error.message)
    return { ok: false, message: "Could not save product fields.", productionLocation, careInstructions }
  }

  return {
    ok: true,
    message: "Product passport fields saved.",
    productionLocation,
    careInstructions,
  }
}
