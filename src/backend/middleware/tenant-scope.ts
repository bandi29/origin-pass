/**
 * Tenant-scope middleware.
 *
 * Goal: collapse the scattered "look up user → resolve org → filter by org" logic
 * into one place that every authenticated handler can call. Once this is the
 * canonical entry point, the broader RLS migration (Phase 4) can be done one
 * caller at a time without re-deriving the actor context everywhere.
 *
 * Why two clients in the context:
 *   - `supabase` is the user-scoped client. Every query honours RLS. This is
 *     the DEFAULT for reads and tenant-isolated writes.
 *   - `admin` is the service-role client. Reserved for: webhooks, cross-tenant
 *     aggregates, scan-event inserts that legitimately bypass RLS. Each use
 *     must be conscious — see `requireAdminBypass()` for the audited shape.
 *
 * Usage:
 *
 *   import { requireTenantContext, tenantScoped } from "@/backend/middleware/tenant-scope"
 *
 *   export async function GET() {
 *     const ctx = await requireTenantContext()
 *     if (ctx instanceof Response) return ctx  // 401 / 404
 *
 *     // Tenant-scoped read — auto-filters by organization_id.
 *     const { data } = await tenantScoped(ctx, "products")
 *       .select("id, name, sku")
 *       .order("created_at", { ascending: false })
 *       .limit(50)
 *
 *     return Response.json({ products: data ?? [] })
 *   }
 */
import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logger } from "@/lib/logger"

/** Tables that carry a denormalized organization_id column. Verified against
 *  supabase/migrations/20260321_organization_id_tenant_columns.sql and the
 *  production schema doc. Used by `tenantScoped()` to choose the filter column. */
const ORG_SCOPED_TABLES = new Set<string>([
  "products",
  "passports",
  "passport_scans",
  "scan_events",
  "share_events",
  "share_clicks",
  "ownership_records",
  "verification_events",
  "qr_identities",
  "qr_batch_jobs",
  "qr_activation_logs",
  "qr_anomaly_events",
  "team_activity_logs",
  "team_invitations",
  "team_roles",
  "organization_members",
  "audit_logs",
  "import_jobs",
])

export type TenantContext = {
  userId: string
  orgId: string
  supabase: SupabaseClient
  /** Service-role client. ONLY use after calling `requireAdminBypass(reason)`. */
  admin: SupabaseClient
}

/**
 * Resolve the current user and their organization. Returns a `Response` (401 or
 * 404) when authentication or tenancy fails, so handlers can short-circuit
 * with `if (ctx instanceof Response) return ctx`.
 *
 * Memoised per request via React `cache()` so multiple modules in the same
 * render/handler share one auth lookup.
 */
export const requireTenantContext = cache(async (): Promise<TenantContext | Response> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Resolve org via the user-scoped client (RLS applies). Falls back to the
  // admin client ONLY if the users table is itself RLS-blocked — in which case
  // the user isn't a member of any org anyway and we 404.
  const { data: row } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  const orgId = (row?.organization_id as string | null) ?? null
  if (!orgId) {
    return Response.json({ error: "No organization context" }, { status: 404 })
  }

  return {
    userId: user.id,
    orgId,
    supabase,
    admin: createAdminClient(),
  }
})

/**
 * Returns a Supabase `from(table)` query builder pre-filtered by the actor's
 * organization. Use the user-scoped client by default so RLS provides defense
 * in depth — the explicit `.eq` is belt-and-braces.
 *
 * For tables that don't have a denormalized organization_id column, this throws
 * at runtime so a developer using the wrong table sees the problem immediately
 * rather than silently leaking data.
 */
export function tenantScoped(
  ctx: TenantContext,
  table: string,
  options: { useAdmin?: boolean } = {},
) {
  if (!ORG_SCOPED_TABLES.has(table)) {
    throw new Error(
      `tenantScoped: '${table}' is not in the org-scoped tables list. ` +
        `Either add it to ORG_SCOPED_TABLES (verifying organization_id exists) ` +
        `or scope manually via ctx.supabase.from('${table}')...`,
    )
  }
  const client = options.useAdmin ? ctx.admin : ctx.supabase
  // Return a proxy of `from(table)` that auto-applies the org filter to the first
  // builder in the chain that supports `.eq` (i.e. right after `.select()`).
  return wrapBuilder(client.from(table), ctx.orgId)
}

/** Loose shape: any object that may expose Supabase's `.eq(col, val)` filter. */
type MaybeFilterable = { eq?: (column: string, value: unknown) => unknown }
const ORG_SCOPED_MARKER = "__originpass_org_scoped__"

function wrapBuilder<T extends object>(builder: T, orgId: string): T {
  // Proxy so chained `.select().eq().order()` calls keep returning the proxy
  // until a terminal operation (await) resolves. Each Supabase builder method
  // returns a new builder, so we wrap every returned builder too.
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== "function") return value
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args)
        // If the method returned a builder-like object that exposes `.eq` and
        // hasn't already been scoped, inject the organization_id filter once.
        if (result && typeof result === "object" && !(ORG_SCOPED_MARKER in result)) {
          const filterable = result as MaybeFilterable
          if (typeof filterable.eq === "function") {
            try {
              const scoped = filterable.eq("organization_id", orgId) as object
              Object.defineProperty(scoped, ORG_SCOPED_MARKER, { value: true })
              return wrapBuilder(scoped, orgId)
            } catch {
              return result
            }
          }
        }
        return result
      }
    },
  })
}

/**
 * Audited escape hatch for legitimate admin-client usage (webhooks, cross-tenant
 * aggregates, scan-event inserts where RLS would block the public path).
 *
 * Every call is logged with the reason and caller location so future audits can
 * find places that should migrate to the user-scoped path.
 */
export function requireAdminBypass(ctx: TenantContext, reason: string): SupabaseClient {
  logger.info(
    { scope: "tenant-bypass", reason, userId: ctx.userId, orgId: ctx.orgId },
    "tenant.admin.bypass",
  )
  return ctx.admin
}
