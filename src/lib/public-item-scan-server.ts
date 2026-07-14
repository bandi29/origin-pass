import { createAdminClient } from "@/lib/supabase/admin"

export type PublicItemScanRow = {
  serial_id: string
  product_name: string | null
  story: string | null
  image_url: string | null
  production_run_name: string | null
  brand_name: string | null
}

type ItemScanQueryRow = {
  serial_id: string
  batch: {
    is_active: boolean
    production_run_name: string | null
    product: {
      name: string | null
      story: string | null
      image_url: string | null
    } | Array<{
      name: string | null
      story: string | null
      image_url: string | null
    }>
  } | Array<{
    is_active: boolean
    production_run_name: string | null
    product: {
      name: string | null
      story: string | null
      image_url: string | null
    } | Array<{
      name: string | null
      story: string | null
      image_url: string | null
    }>
  }>
  brand: {
    brand_name: string | null
  } | Array<{
    brand_name: string | null
  }>
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

/**
 * Server-only public verification payload. Replaces the retired `public_item_scan`
 * PostgREST view so anonymous clients cannot query verification data directly.
 */
export async function fetchPublicItemScanBySerial(
  serialId: string,
): Promise<PublicItemScanRow | null> {
  const trimmed = serialId.trim()
  if (!trimmed) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("items")
    .select(
      `
      serial_id,
      batch:batches!inner (
        is_active,
        production_run_name,
        product:products!inner (
          name,
          story,
          image_url
        )
      ),
      brand:profiles!inner (
        brand_name
      )
    `,
    )
    .eq("serial_id", trimmed)
    .eq("batch.is_active", true)
    .maybeSingle()

  if (error) {
    console.error("fetchPublicItemScanBySerial:", error.message)
    return null
  }

  const row = data as ItemScanQueryRow | null
  if (!row) return null

  const batch = first(row.batch)
  const product = first(batch?.product)
  const brand = first(row.brand)

  return {
    serial_id: row.serial_id,
    product_name: product?.name ?? null,
    story: product?.story ?? null,
    image_url: product?.image_url ?? null,
    production_run_name: batch?.production_run_name ?? null,
    brand_name: brand?.brand_name ?? null,
  }
}
