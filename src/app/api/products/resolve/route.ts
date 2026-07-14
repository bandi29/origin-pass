import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { ilikeLiteralFragment, resolveScopedProductIds } from "@/lib/products/notification-product-resolve"
import { normalizeSkuHint, skuExactIlikeCandidates } from "@/lib/products/sku-match"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"

/**
 * Resolve a catalog product id for the current user (scoped org).
 * Tries SKU (case-insensitive), then exact name (case-insensitive), then name contains (ILIKE %…%).
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureBrandProfile(supabase, user)

  const url = new URL(req.url)
  const sku = url.searchParams.get("sku")?.trim() ?? ""
  const name = url.searchParams.get("name")?.trim() ?? ""

  if (!sku && !name) {
    return Response.json({ error: "Provide sku and/or name" }, { status: 400 })
  }

  const scoped = await getScopedProductIds(user.id)
  if (scoped.length === 0) {
    console.warn("[api/products/resolve] no scoped products for user", user.id)
    return Response.json({ productId: null, reason: "no_scoped_products" })
  }

  const base = () =>
    supabase.from("products").select("id").in("id", scoped).eq("is_archived", false)

  let result: Awaited<ReturnType<typeof resolveScopedProductIds>>
  try {
    result = await resolveScopedProductIds({ sku, name }, async (filter) => {
      if (filter.type === "sku") {
        const candidates = skuExactIlikeCandidates(filter.value)
        for (const pattern of candidates) {
          const { data, error } = await base().ilike("sku", pattern).limit(2)
          if (error) throw error
          const ids = (data ?? []).map((r) => r.id as string)
          if (ids.length === 1) return ids
          if (ids.length > 1) return ids
        }
        const frag = ilikeLiteralFragment(normalizeSkuHint(filter.value) || filter.value.trim())
        if (frag.length >= 3) {
          const { data, error } = await base().ilike("sku", `%${frag}%`).limit(2)
          if (error) throw error
          return (data ?? []).map((r) => r.id as string)
        }
        return []
      }
      if (filter.type === "name_exact") {
        const { data, error } = await base().ilike("name", filter.value).limit(2)
        if (error) throw error
        return (data ?? []).map((r) => r.id as string)
      }
      const { data, error } = await base().ilike("name", filter.value).limit(2)
      if (error) throw error
      return (data ?? []).map((r) => r.id as string)
    })
  } catch (e: unknown) {
    console.error("[api/products/resolve] query:", e)
    return Response.json({ error: "Lookup failed" }, { status: 500 })
  }

  const { productId, reason } = result

  if (productId) {
    return Response.json({ productId })
  }

  console.warn("[api/products/resolve] ambiguous or no match", {
    sku: sku || undefined,
    name: name || undefined,
    scopedCount: scoped.length,
    reason,
  })

  return Response.json({
    productId: null,
    reason,
  })
}
