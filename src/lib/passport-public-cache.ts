/**
 * Cached fetcher for the public passport view (`/p/[qrToken]`).
 *
 * The hottest path in the application is the consumer QR-scan landing page. The
 * data needed to render it (passport, product, brand profile, latest batch) is
 * write-rarely / read-often, so we wrap the fetch in `unstable_cache` with a
 * `passport:${id}` tag for explicit invalidation.
 *
 * Invalidate the cache after any of these writes:
 *   - passport.status / metadata change → `revalidateTag(passportTag(id))`
 *   - product.* fields used in the view change → same tag
 *   - profile.brand_name / passport_template_key change → invalidate every passport
 *     for that brand (rare; usually a settings change)
 *
 * The dynamic scan-recording write still happens on every request via `after()`;
 * only the rendered passport data is cached.
 */
import { unstable_cache, revalidateTag } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"

export type CachedPassportSnapshot = {
  passport: {
    id: string
    status: string
    serial_number: string | null
    product_id: string | null
    metadata: Record<string, unknown> | null
  } | null
  product: {
    name: string
    description: string | null
    category: string | null
    story: string | null
    materials: string | null
    origin: string | null
    image_url: string | null
    brand_id: string | null
    metadata: Record<string, unknown> | null
    passport_template_key: string | null
  } | null
  profile: {
    brand_name: string | null
    passport_template_key: string | null
  } | null
  batch: {
    production_run_name: string | null
    artisan_name: string | null
    location: string | null
    produced_at: string | null
  } | null
}

export function passportTag(passportId: string): string {
  return `passport:${passportId}`
}

export async function invalidatePassportCache(passportId: string): Promise<void> {
  revalidateTag(passportTag(passportId), "max")
}

async function fetchPassportSnapshotUncached(passportId: string): Promise<CachedPassportSnapshot> {
  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, status, serial_number, product_id, metadata")
    .eq("id", passportId)
    .single()

  if (!passport) {
    return { passport: null, product: null, profile: null, batch: null }
  }

  const productId = passport.product_id as string | null
  if (!productId) {
    return {
      passport: passport as CachedPassportSnapshot["passport"],
      product: null,
      profile: null,
      batch: null,
    }
  }

  const [productRes, batchRes] = await Promise.all([
    admin
      .from("products")
      .select(
        "name, description, category, story, materials, origin, image_url, brand_id, metadata, passport_template_key",
      )
      .eq("id", productId)
      .single(),
    admin
      .from("batches")
      .select("production_run_name, artisan_name, location, produced_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const product = productRes.data as CachedPassportSnapshot["product"]
  let profile: CachedPassportSnapshot["profile"] = null
  if (product?.brand_id) {
    const { data: profileRow } = await admin
      .from("profiles")
      .select("brand_name, passport_template_key")
      .eq("id", product.brand_id)
      .maybeSingle()
    profile = (profileRow as CachedPassportSnapshot["profile"]) ?? null
  }

  return {
    passport: passport as CachedPassportSnapshot["passport"],
    product,
    profile,
    batch: (batchRes.data as CachedPassportSnapshot["batch"]) ?? null,
  }
}

/**
 * Public entry: returns a cached snapshot. 5-minute revalidate is a safety net;
 * tag-based invalidation is the primary freshness mechanism.
 */
export async function getCachedPassportSnapshot(passportId: string): Promise<CachedPassportSnapshot> {
  const cached = unstable_cache(
    (id: string) => fetchPassportSnapshotUncached(id),
    ["passport-snapshot", passportId],
    {
      tags: [passportTag(passportId)],
      revalidate: 300,
    },
  )
  return cached(passportId)
}
