import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds, NIL_UUID } from "@/backend/modules/organizations/scope"
import { mapPassportsToRegistryRows, type PassportRegistryRow } from "@/lib/passport-registry-map"

type PassportRegistryQueryRow = {
  id: string
  serial_number: string
  created_at: string | null
  product?: unknown
}

export async function getPassportRegistryRowsForUser(
  userId: string,
  options?: { viewThisMonth?: boolean },
): Promise<PassportRegistryRow[]> {
  const productIds = await getScopedProductIds(userId)
  const admin = createAdminClient()

  let query = admin
    .from("passports")
    .select(
      `
      id,
      serial_number,
      created_at,
      product:products(
        name,
        batch:batches(production_run_name)
      )
    `,
    )
    .in("product_id", productIds.length ? productIds : [NIL_UUID])
    .order("created_at", { ascending: false })
    .limit(100)

  if (options?.viewThisMonth) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    query = query.gte("created_at", monthStart).lt("created_at", monthEnd)
  }

  const { data, error } = await query

  if (error) {
    console.error("getPassportRegistryRowsForUser:", error.message)
    return []
  }

  return mapPassportsToRegistryRows((data ?? []) as PassportRegistryQueryRow[])
}
