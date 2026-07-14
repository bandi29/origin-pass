/** Plain rows for `PassportRegistryTable` (server-safe mapping from Supabase `passports`). */

/** URL-safe slug for wizard success redirects (`hand craft leather` → `hand-craft-leather`). */
export function productNameToQuerySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function productNameMatchesQuerySlug(productName: string, slug: string): boolean {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return false
  return productNameToQuerySlug(productName) === normalized
}

export type PassportRegistryRow = {
  /** Passport UUID — used for admin edit/detail routes. */
  id: string
  serial_id: string
  created_at: string | null
  productName: string
  batchName: string
}

function productNameFromProduct(product: unknown): string {
  const p = product as { name?: string } | { name?: string }[] | null | undefined
  if (Array.isArray(p)) return p[0]?.name?.trim() || "—"
  return p?.name?.trim() || "—"
}

function batchNameFromProduct(product: unknown): string {
  const p = product as
    | { batch?: { production_run_name?: string } | { production_run_name?: string }[] }
    | { batch?: { production_run_name?: string } | { production_run_name?: string }[] }[]
    | null
    | undefined
  const row = Array.isArray(p) ? p[0] : p
  const batch = row?.batch
  const b = Array.isArray(batch) ? batch[0] : batch
  return b?.production_run_name?.trim() || "—"
}

export function mapPassportsToRegistryRows(
  passports: {
    id: string
    serial_number: string
    created_at: string | null
    product?: unknown
  }[],
): PassportRegistryRow[] {
  return passports.map((passport) => ({
    id: passport.id,
    serial_id: passport.serial_number,
    created_at: passport.created_at,
    productName: productNameFromProduct(passport.product),
    batchName: batchNameFromProduct(passport.product),
  }))
}

/** @deprecated Legacy items table mapper — use mapPassportsToRegistryRows. */
export function mapItemsToRegistryRows(
  items: { id: string; serial_id: string; created_at: string | null; batch?: unknown }[],
): PassportRegistryRow[] {
  return items.map((item) => ({
    id: item.id,
    serial_id: item.serial_id,
    created_at: item.created_at,
    productName: productNameFromBatch(item.batch),
    batchName: batchNameFromBatch(item.batch),
  }))
}

function productNameFromBatch(batch: unknown): string {
  const b = batch as { product?: { name?: string } | { name?: string }[] } | undefined
  const p = b?.product
  return (Array.isArray(p) ? p[0]?.name : p?.name) || "—"
}

function batchNameFromBatch(batch: unknown): string {
  return (batch as { production_run_name?: string })?.production_run_name || "—"
}
