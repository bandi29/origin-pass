"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { NIL_UUID } from "@/backend/modules/organizations/scope"

export type PassportRow = {
  id: string
  passport_uid: string
  product_id: string
  serial_number: string
  status: string
  created_at: string
  product_name?: string
  scan_count?: number
}

export async function getPassportsForUser(): Promise<PassportRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const productIds = await getScopedProductIds(user.id)
  const admin = createAdminClient()

  const { data: passports, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, product_id, serial_number, status, created_at, product:products(id,name)"
    )
    .in("product_id", productIds.length ? productIds : [NIL_UUID])
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    console.warn("getPassportsForUser error:", error.message)
    return []
  }

  const rows = (passports ?? []) as Array<{
    id: string
    passport_uid: string
    product_id: string
    serial_number: string
    status: string
    created_at: string
    product: { name?: string } | { name?: string }[] | null
  }>

  const ids = rows.map((r) => r.id)
  const { data: scanCounts } =
    ids.length > 0
      ? await admin
          .from("passport_scans")
          .select("passport_id")
          .in("passport_id", ids)
      : { data: [] }

  const countMap = new Map<string, number>()
  const scans = (scanCounts ?? []) as { passport_id: string }[]
  for (let i = 0; i < scans.length; i++) {
    const pid = scans[i].passport_id
    countMap.set(pid, (countMap.get(pid) ?? 0) + 1)
  }

  return rows.map((r) => ({
    id: r.id,
    passport_uid: r.passport_uid,
    product_id: r.product_id,
    serial_number: r.serial_number,
    status: r.status,
    created_at: r.created_at,
    product_name: Array.isArray(r.product) ? r.product[0]?.name : r.product?.name,
    scan_count: countMap.get(r.id) ?? 0,
  }))
}

export async function getProductsForUser(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("products")
    .select("id, name")
    .eq("brand_id", user.id)
    .order("name")

  if (error) {
    console.warn("getProductsForUser error:", error.message)
    return []
  }
  return (data ?? []) as { id: string; name: string }[]
}
