import { createAdminClient } from "@/lib/supabase/admin"

const NIL_UUID = "00000000-0000-0000-0000-000000000000"

type ProductRow = { id: string }
type PassportRow = { id: string }

export async function getScopedProductIds(userId: string): Promise<string[]> {
  const admin = createAdminClient()

  const { data: appUser } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()

  const orgId = appUser?.organization_id as string | null | undefined
  const orFilters = [`brand_id.eq.${userId}`]
  if (orgId) orFilters.push(`organization_id.eq.${orgId}`)

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

export async function getScopedPassportIds(userId: string): Promise<string[]> {
  const productIds = await getScopedProductIds(userId)
  if (!productIds.length) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passports")
    .select("id")
    .in("product_id", productIds.length ? productIds : [NIL_UUID])

  if (error) {
    console.warn("getScopedPassportIds error:", error.message)
    return []
  }

  return ((data ?? []) as PassportRow[]).map((row) => row.id)
}

export { NIL_UUID }
