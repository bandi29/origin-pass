import { createAdminClient } from "@/lib/supabase/admin"

const NIL_UUID = "00000000-0000-0000-0000-000000000000"

type ProductRow = { id: string }
type PassportRow = { id: string }

async function resolveScopeFilters(userId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: appUser } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()
  const orgId = appUser?.organization_id as string | null | undefined
  const orFilters = [`brand_id.eq.${userId}`]
  if (orgId) orFilters.push(`organization_id.eq.${orgId}`)
  return orFilters
}

export async function getScopedProductIds(userId: string): Promise<string[]> {
  const admin = createAdminClient()
  const orFilters = await resolveScopeFilters(userId)
  const { data, error } = await admin
    .from("products")
    .select("id")
    .or(orFilters.join(","))

  if (error) {
    console.warn("getScopedProductIds error:", error.message)
    return []
  }

  return ((data ?? []) as ProductRow[]).map((row) => row.id)
}

/**
 * Single-product authorization check. Avoids loading the full product list into memory
 * — runs one scoped query that returns at most one row.
 */
export async function isProductInScope(userId: string, productId: string): Promise<boolean> {
  if (!productId) return false
  const admin = createAdminClient()
  const orFilters = await resolveScopeFilters(userId)
  const { data, error } = await admin
    .from("products")
    .select("id")
    .eq("id", productId)
    .or(orFilters.join(","))
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn("isProductInScope error:", error.message)
    return false
  }
  return Boolean(data)
}

/**
 * Single-passport authorization check via its product scope.
 */
export async function isPassportInScope(userId: string, passportId: string): Promise<boolean> {
  if (!passportId) return false
  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("product_id")
    .eq("id", passportId)
    .maybeSingle()
  const productId = (passport as { product_id?: string | null } | null)?.product_id ?? null
  if (!productId) return false
  return isProductInScope(userId, productId)
}

async function fetchPassportIdsForProducts(productIds: string[]): Promise<string[]> {
  if (!productIds.length) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passports")
    .select("id")
    .in("product_id", productIds)

  if (error) {
    console.warn("fetchPassportIdsForProducts error:", error.message)
    return []
  }

  return ((data ?? []) as PassportRow[]).map((row) => row.id)
}

export async function getScopedPassportIds(userId: string): Promise<string[]> {
  const productIds = await getScopedProductIds(userId)
  return fetchPassportIdsForProducts(productIds)
}

/** Single round-trip for product + passport scope (avoids duplicate product queries). */
export async function getScopedOrgScope(userId: string): Promise<{
  productIds: string[]
  passportIds: string[]
}> {
  const productIds = await getScopedProductIds(userId)
  const passportIds = await fetchPassportIdsForProducts(productIds)
  return { productIds, passportIds }
}

/**
 * Returns the organization_id for the given user, or null if the user has no org yet.
 *
 * This is the preferred scope helper for analytics and listing queries that touch
 * tables with a denormalized `organization_id` column (`passports`, `passport_scans`,
 * `ownership_records`, `verification_events`, `qr_identities`, etc.). It returns a
 * single small value instead of a potentially-huge ID array — keeping the IN-clause
 * parameter count constant and avoiding the Postgres ~32k parameter ceiling.
 */
export async function getScopedOrgId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()
  return (data?.organization_id as string | null) ?? null
}

export { NIL_UUID }
