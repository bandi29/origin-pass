import { requireTenantContext } from "@/backend/middleware/tenant-scope"

/**
 * Lightweight catalog for the signed-in user's org (id, name, sku) for
 * notification matching / pickers.
 *
 * Migrated to use `requireTenantContext` + the user-scoped Supabase client.
 * RLS enforces tenant isolation; the explicit `.eq("organization_id", orgId)`
 * is belt-and-braces defense in depth and lets the query plan as a direct
 * index scan on `idx_products_organization_id`.
 *
 * Note: the previous version called `ensureBrandProfile` on every request to
 * bootstrap first-time users. That responsibility now belongs to the signup /
 * onboarding flow — by the time this endpoint is hit, `requireTenantContext`
 * has already confirmed a tenant exists (returning 404 otherwise).
 */
export async function GET() {
  const ctx = await requireTenantContext()
  if (ctx instanceof Response) return ctx
  const { supabase, orgId } = ctx

  const baseQuery = () =>
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .limit(250)

  const { data, error } = await baseQuery().order("updated_at", { ascending: false })
  if (error) {
    // Some products predate the `updated_at` column. Fall back to `created_at`
    // ordering so the picker still renders.
    const { data: fallback } = await baseQuery().order("created_at", { ascending: false })
    return Response.json({ products: fallback ?? [] })
  }

  return Response.json({ products: data ?? [] })
}
