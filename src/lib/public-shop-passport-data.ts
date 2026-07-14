import { createServerSupabaseClient } from "@/lib/supabase"
import { fetchShopifyProductSnapshot, isValidShopDomain } from "@/lib/shopify"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { fetchPublicVerificationEvidence } from "@/lib/public-verification-evidence"
import { dataProvenanceForPassport } from "@/lib/evidence-scope"
import {
  fieldClaimProvenance,
  resolvedFieldDisplayValue,
} from "@/lib/product-compliance-fields"
import { VERIFICATION_FIELD_KEYS } from "@/lib/verification-field-keys"
import type { LuxuryPassportData } from "@/components/passport/LuxuryTemplateView"

/** CDN / browser SWR policy for public QR passport HTML. */
export const PUBLIC_PASSPORT_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600" as const

/** `[shopId]` may be the subdomain or the full `*.myshopify.com` host. */
export function normalizeShopDomain(shopId: string): string {
  const raw = decodeURIComponent(shopId).trim().toLowerCase()
  return raw.endsWith(".myshopify.com") ? raw : `${raw}.myshopify.com`
}

function asCompositionMap(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value)
    if (key && Number.isFinite(n)) out[key] = n
  }
  return Object.keys(out).length ? out : null
}

type StoreRow = {
  id: string
  name: string | null
  shop_domain: string | null
  shopify_access_token: string | null
  global_production_location: string | null
  global_care_instructions: string | null
}

type ProductRow = {
  id: string
  materials: string | null
  story: string | null
  compliance_data: unknown
}

type VariantRow = {
  material_composition: unknown
  carbon_footprint: number | null
}

/** Safe empty passport — never throw / never cache an error shell as a hard failure. */
export function emptyPublicShopPassportData(): LuxuryPassportData {
  return {
    productTitle: null,
    imageUrl: null,
    brandName: null,
    productionLocation: null,
    careInstructions: null,
    story: null,
    materials: null,
    materialComposition: null,
    carbonFootprint: null,
    dataLevel: "store",
    dataProvenance: "fallback",
    evidence: undefined,
  }
}

async function fetchStoreByDomain(shopDomain: string): Promise<StoreRow | null> {
  if (!isValidShopDomain(shopDomain)) return null
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("organizations")
      .select(
        "id, name, shop_domain, shopify_access_token, global_production_location, global_care_instructions",
      )
      .eq("shop_domain", shopDomain)
      .maybeSingle()
    if (error) return null
    return (data as StoreRow | null) ?? null
  } catch {
    return null
  }
}

async function fetchProductByExternalId(
  organizationId: string,
  productId: string,
): Promise<ProductRow | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("products")
      .select("id, materials, story, compliance_data")
      .eq("organization_id", organizationId)
      .eq("external_product_id", productId)
      .maybeSingle()
    if (error) return null
    return (data as ProductRow | null) ?? null
  } catch {
    return null
  }
}

async function fetchVariantByExternalId(
  organizationId: string,
  variantId: string,
): Promise<VariantRow | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("passports")
      .select("material_composition, carbon_footprint")
      .eq("organization_id", organizationId)
      .eq("external_variant_id", variantId)
      .maybeSingle()
    if (error || !data) return null
    return data as VariantRow
  } catch {
    return null
  }
}

/**
 * Load consumer-facing passport data for Shopify QR / short-link entry points.
 *
 * Cold path: store lookup → then product + optional variant + Shopify snapshot
 * in parallel via Promise.all. Downstream evidence fetch is best-effort and
 * never fails the page (so CDN SWR never locks onto an error response).
 */
export async function loadPublicShopPassportData(input: {
  shopId: string
  productId: string
  variantId?: string | null
}): Promise<LuxuryPassportData> {
  try {
    const shopDomain = normalizeShopDomain(input.shopId)
    const productId = decodeURIComponent(input.productId).trim()
    const variantId = input.variantId?.trim() || null

    if (!productId) return emptyPublicShopPassportData()

    const store = await fetchStoreByDomain(shopDomain)
    if (!store) return emptyPublicShopPassportData()

    // Auto-refreshing expiring offline token (skip the round-trip when the
    // store was never connected).
    const token = store.shopify_access_token ? await getShopifyAdminToken(shopDomain) : null

    // Parallelize independent remotes on cache miss (Supabase product/variant + Shopify).
    const [product, variant, snapshot] = await Promise.all([
      fetchProductByExternalId(store.id, productId),
      variantId ? fetchVariantByExternalId(store.id, variantId) : Promise.resolve(null),
      token
        ? fetchShopifyProductSnapshot(shopDomain, token, productId).catch(() => null)
        : Promise.resolve(null),
    ])

    const dataLevel: LuxuryPassportData["dataLevel"] = variant
      ? "variant"
      : product
        ? "product"
        : "store"

    const materialComposition = asCompositionMap(variant?.material_composition)
    const productionProvenance = fieldClaimProvenance(
      VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
      product?.compliance_data,
      store.global_production_location,
    )
    const careProvenance = fieldClaimProvenance(
      VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
      product?.compliance_data,
      store.global_care_instructions,
    )
    const passportUsesRecordFields = Boolean(
      product?.materials?.trim() ||
        product?.story?.trim() ||
        productionProvenance === "record" ||
        careProvenance === "record" ||
        (materialComposition && Object.keys(materialComposition).length > 0) ||
        (variant?.carbon_footprint != null && Number.isFinite(variant.carbon_footprint)),
    )
    const dataProvenance = dataProvenanceForPassport({
      hasRecordLevelData: passportUsesRecordFields,
    }).provenance

    let evidence: LuxuryPassportData["evidence"]
    try {
      evidence = await fetchPublicVerificationEvidence({
        storeId: store.id,
        productId: product?.id ?? null,
        passportUsesRecordFields,
        productComplianceData: product?.compliance_data,
        brandDefaults: {
          productionLocation: store.global_production_location,
          careInstructions: store.global_care_instructions,
        },
        fieldClaimProvenance: {
          [VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION]: productionProvenance,
          [VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS]: careProvenance,
        },
      })
    } catch {
      evidence = undefined
    }

    return {
      productTitle: snapshot?.title ?? null,
      imageUrl: snapshot?.imageUrl ?? null,
      brandName: store.name ?? null,
      productionLocation: resolvedFieldDisplayValue(
        VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION,
        product?.compliance_data,
        store.global_production_location,
      ),
      careInstructions: resolvedFieldDisplayValue(
        VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
        product?.compliance_data,
        store.global_care_instructions,
      ),
      story: product?.story ?? null,
      materials: product?.materials ?? null,
      materialComposition,
      carbonFootprint: variant?.carbon_footprint ?? null,
      dataLevel,
      dataProvenance,
      evidence,
    }
  } catch {
    // Never surface a thrown failure to the route — keeps SWR from caching an error shell.
    return emptyPublicShopPassportData()
  }
}
