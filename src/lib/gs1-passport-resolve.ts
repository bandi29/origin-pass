import { createServerSupabaseClient } from "@/lib/supabase"
import { shopSubdomainFromDomain } from "@/lib/shopify-public-passport-url"
import {
  normalizeGtinDigits,
  padGTIN,
  parseGS1DigitalLinkPath,
  validateGTIN,
  type GS1DigitalLinkParts,
} from "@/lib/gs1"
import { isValidUuid } from "@/lib/security"

export type Gs1MatchedBy = "variant_gtin" | "product_gtin" | "id"

export type Gs1ResolvedProduct = {
  productId: string
  externalProductId: string | null
  /** Shopify variant id when resolved via passports.gtin (DPP-03). */
  externalVariantId: string | null
  shopDomain: string | null
  shopSlug: string | null
  name: string | null
  gtin: string | null
  gln: string | null
  defaultLotNumber: string | null
  materials: string | null
  originCountry: string | null
  productionLocation: string | null
  certificates: Array<{ name: string; fieldKey: string }>
  lot?: string
  serial?: string
  passportToken: string | null
  matchedBy: Gs1MatchedBy
}

type ProductLookupRow = {
  id: string
  name: string | null
  gtin: string | null
  gln: string | null
  default_lot_number: string | null
  materials: string | null
  origin_country: string | null
  external_product_id: string | null
  compliance_data: Record<string, unknown> | null
  organization_id: string | null
}

type PassportGtinRow = {
  id: string
  gtin: string | null
  external_variant_id: string | null
  serial_number: string | null
  verify_token: string | null
  passport_uid: string | null
  product_id: string
}

function productionFromCompliance(compliance: Record<string, unknown> | null): string | null {
  if (!compliance) return null
  const v = compliance.production_location
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/** Candidate GTIN strings to try against the DB (padded + unpadded variants). */
export function gtinLookupCandidates(gtin: string): string[] {
  const digits = normalizeGtinDigits(gtin)
  if (!digits) return []
  const padded = padGTIN(digits)
  const stripped = digits.replace(/^0+/, "") || "0"
  const set = new Set<string>([digits, padded])
  if (stripped !== digits) set.add(stripped)
  if (padded.length === 14) {
    set.add(padded.slice(1))
    set.add(padded.slice(2))
  }
  return [...set]
}

async function mapProductRow(
  row: ProductLookupRow,
  matchedBy: Gs1MatchedBy,
  parts?: GS1DigitalLinkParts,
  matchedPassport?: PassportGtinRow | null,
): Promise<Gs1ResolvedProduct> {
  const productLocation = productionFromCompliance(row.compliance_data)

  let certificates: Gs1ResolvedProduct["certificates"] = []
  let passportToken: string | null = null
  let shopDomain: string | null = null
  let brandLocation: string | null = null
  let externalVariantId: string | null = matchedPassport?.external_variant_id?.trim() || null

  try {
    const supabase = createServerSupabaseClient()
    const orgPromise = row.organization_id
      ? supabase
          .from("organizations")
          .select("shop_domain, global_production_location")
          .eq("id", row.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null as null })

    const passportPromise = matchedPassport
      ? Promise.resolve({ data: matchedPassport })
      : supabase
          .from("passports")
          .select("id, gtin, external_variant_id, serial_number, verify_token, passport_uid, product_id")
          .eq("product_id", row.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

    const [{ data: certs }, { data: passport }, { data: org }] = await Promise.all([
      supabase
        .from("certificates")
        .select("field_key, original_filename")
        .eq("product_id", row.id)
        .limit(20),
      passportPromise,
      orgPromise,
    ])
    certificates = (certs ?? []).map((c) => ({
      name:
        (c.original_filename as string | null)?.trim() ||
        (c.field_key as string) ||
        "Certificate",
      fieldKey: String(c.field_key ?? ""),
    }))
    const p = (passport as PassportGtinRow | null) ?? null
    if (!externalVariantId) externalVariantId = p?.external_variant_id?.trim() || null
    passportToken =
      p?.serial_number?.trim() ||
      p?.verify_token?.trim() ||
      p?.passport_uid?.trim() ||
      null
    const orgRow = org as {
      shop_domain?: string | null
      global_production_location?: string | null
    } | null
    shopDomain = orgRow?.shop_domain?.trim() || null
    brandLocation = orgRow?.global_production_location?.trim() || null
  } catch {
    certificates = []
    passportToken = null
  }

  const resolvedGtin =
    matchedPassport?.gtin?.trim() ||
    row.gtin?.trim() ||
    null

  return {
    productId: row.id,
    externalProductId: row.external_product_id,
    externalVariantId,
    shopDomain,
    shopSlug: shopDomain ? shopSubdomainFromDomain(shopDomain) : null,
    name: row.name,
    gtin: resolvedGtin,
    gln: row.gln,
    defaultLotNumber: row.default_lot_number,
    materials: row.materials,
    originCountry: row.origin_country?.trim() || productLocation || brandLocation,
    productionLocation: productLocation || brandLocation,
    certificates,
    lot: parts?.lot,
    serial: parts?.serial,
    passportToken,
    matchedBy,
  }
}

const PRODUCT_SELECT =
  "id, name, gtin, gln, default_lot_number, materials, origin_country, external_product_id, compliance_data, organization_id"

async function findProductByGtin(gtin: string): Promise<ProductLookupRow | null> {
  const supabase = createServerSupabaseClient()
  const candidates = gtinLookupCandidates(gtin)
  if (candidates.length === 0) return null

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("gtin", candidates)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as ProductLookupRow
}

/**
 * DPP-03: look up passports.gtin first (variant-level), then join parent product.
 */
async function findByVariantGtin(
  gtin: string,
): Promise<{ product: ProductLookupRow; passport: PassportGtinRow } | null> {
  const supabase = createServerSupabaseClient()
  const candidates = gtinLookupCandidates(gtin)
  if (candidates.length === 0) return null

  const { data: passport, error } = await supabase
    .from("passports")
    .select("id, gtin, external_variant_id, serial_number, verify_token, passport_uid, product_id")
    .in("gtin", candidates)
    .limit(1)
    .maybeSingle()

  if (error || !passport) return null
  const passportRow = passport as PassportGtinRow
  if (!passportRow.product_id) return null

  const product = await findProductById(passportRow.product_id)
  if (!product) return null
  return { product, passport: passportRow }
}

async function findProductById(id: string): Promise<ProductLookupRow | null> {
  if (!isValidUuid(id)) return null
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .eq("is_archived", false)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as ProductLookupRow
}

/**
 * Resolve a GS1 Digital Link path to a product (and optional variant context).
 * Order: variant GTIN (passports) -> product GTIN -> product UUID hybrid fallback.
 */
export async function resolveGs1DigitalLinkPath(
  pathSegments: string[],
): Promise<Gs1ResolvedProduct | null> {
  try {
    const parts = parseGS1DigitalLinkPath(pathSegments)
    const rawFirst = decodeURIComponent(String(pathSegments[0] ?? "").trim())

    if (parts?.gtin) {
      if (validateGTIN(parts.gtin)) {
        const byVariant = await findByVariantGtin(parts.gtin)
        if (byVariant) {
          return mapProductRow(byVariant.product, "variant_gtin", parts, byVariant.passport)
        }
        const byProduct = await findProductByGtin(parts.gtin)
        if (byProduct) return mapProductRow(byProduct, "product_gtin", parts)
      }
      const byId = await findProductById(rawFirst === "01" ? pathSegments[1] ?? "" : rawFirst)
      if (byId) return mapProductRow(byId, "id", parts ?? undefined)
      return null
    }

    const byId = await findProductById(rawFirst)
    if (byId) return mapProductRow(byId, "id")
    return null
  } catch {
    return null
  }
}

/** Machine-readable GS1 JSON-LD for content negotiation. */
export function buildGs1JsonLd(product: Gs1ResolvedProduct, requestUrl: string) {
  return {
    "@context": "https://gs1.org/voc/",
    "@type": "Product",
    gtin: product.gtin ? padGTIN(product.gtin) : undefined,
    name: product.name ?? undefined,
    countryOfOrigin: product.originCountry ?? undefined,
    materials: product.materials ?? undefined,
    certificates: product.certificates.map((c) => c.name),
    lotNumber: product.lot ?? product.defaultLotNumber ?? undefined,
    serialNumber: product.serial ?? undefined,
    gln: product.gln ?? undefined,
    variantId: product.externalVariantId ?? undefined,
    url: requestUrl,
  }
}
