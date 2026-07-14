# RLS Migration Cookbook

## Status

**Phase 4 (foundation) is complete.** The infrastructure is in place; the remaining
work is a per-endpoint migration that should be done a few routes at a time and
soak-tested between batches. There are ~138 files that call `createAdminClient()`
today. Many are legitimate (webhooks, scan-pipeline writes, cross-tenant
aggregates); the goal is to make the legitimate ones explicit and migrate the
rest.

## Why we're doing this

Today, the app uses `createAdminClient()` (Supabase service role) almost
everywhere. RLS policies exist on every tenant-scoped table, but they're never
exercised by the application — the trust model collapses into "the Node process
is honest." One bad scope check anywhere leaks cross-tenant data.

After this phase: the user-scoped Supabase client is the default. RLS enforces
isolation in the database. The admin client is reserved for explicit,
audit-logged operations.

## The pattern

### Before

```ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const scoped = await getScopedProductIds(user.id)
  if (scoped.length === 0) return Response.json({ products: [] })

  const { data } = await admin
    .from("products")
    .select("id, name")
    .in("id", scoped)         // ❌ huge IN clause, can hit Postgres param limit
    .limit(250)

  return Response.json({ products: data ?? [] })
}
```

### After

```ts
import { requireTenantContext } from "@/backend/middleware/tenant-scope"

export async function GET() {
  const ctx = await requireTenantContext()
  if (ctx instanceof Response) return ctx           // 401 or 404 short-circuit
  const { supabase, orgId } = ctx

  const { data } = await supabase                   // ✅ user-scoped → RLS enforced
    .from("products")
    .select("id, name")
    .eq("organization_id", orgId)                   // ✅ defense in depth + index-friendly
    .limit(250)

  return Response.json({ products: data ?? [] })
}
```

Key gains:

1. **RLS now enforces isolation** — even if the explicit `.eq` is forgotten,
   the database refuses to return cross-tenant rows.
2. **Single index scan** — no array round-trip, no parameter ceiling.
3. **One auth lookup per request** — `requireTenantContext()` is memoized via
   React `cache()`, so multiple modules in the same handler share the result.
4. **Audited admin escape hatch** — when admin access is genuinely required,
   `requireAdminBypass(ctx, reason)` logs the bypass with a reason so future
   audits can find regressions.

## When to keep the admin client

The admin client (`createAdminClient` or `requireAdminBypass(ctx, ...)`) is
correct for:

| Use case | Why |
|---|---|
| Scan-pipeline writes (worker) | Public scans run unauthenticated; the worker is trusted. |
| Webhooks (Paddle, Resend) | No user session — request authenticity is verified by signature. |
| Cross-tenant aggregates (admin dashboards) | Intentional super-admin read. |
| One-time signup bootstrap (users / organizations seed) | Predates the user's RLS context. |
| Schema introspection / migrations | Not user-scoped by definition. |

Everything else should migrate. The architecture review (§9.1) flagged 138+
files; expect ~25 to legitimately remain on the admin client after audit.

## Migration order

Process by risk and traffic:

1. **Read endpoints (low risk, high count).** Start with API routes under
   `src/app/api/**/route.ts` that issue only `SELECT`s. RLS read policies are
   the easiest to verify.
2. **Single-row writes (medium risk).** Updates and deletes where the user is
   the natural scope (passport edits, product edits, profile updates).
3. **Multi-row writes (higher risk).** Batch imports, bulk activations. Audit
   RLS write policies carefully — `WITH CHECK` clauses must accept every
   inserted row.
4. **Server components (page.tsx).** Same patterns, but watch for caching
   interactions with `unstable_cache`.
5. **Workers / scheduled jobs.** Most of these legitimately stay on admin.
   Convert any that operate on behalf of a single user (e.g. AI generation
   triggered by a user action).

## Verifying a migrated endpoint

For every converted endpoint:

1. **Sign in as user A, call the endpoint, confirm normal response.**
2. **Sign in as user B in a separate org, call the endpoint with user A's
   resource id (passport id, product id, etc.) — confirm 404 or empty result.**
   This is the cross-tenant smoke test.
3. **Sign out, hit the endpoint anonymously — confirm 401.**
4. **Watch the request span (after OTel install) — confirm the SELECT plans as
   an index scan, not a seq scan.**

## Helper API reference

```ts
// Resolve actor + org. Returns Response (401/404) on failure.
const ctx = await requireTenantContext()
if (ctx instanceof Response) return ctx
const { userId, orgId, supabase, admin } = ctx

// Most common pattern — direct query on the user-scoped client.
await supabase.from("products").select("...").eq("organization_id", orgId)

// Use the proxy wrapper when you don't want to write the .eq manually.
// Note: tenantScoped throws if the table isn't on the ORG_SCOPED_TABLES list.
import { tenantScoped } from "@/backend/middleware/tenant-scope"
await tenantScoped(ctx, "products").select("id, name").limit(10)

// Audited admin bypass.
import { requireAdminBypass } from "@/backend/middleware/tenant-scope"
const admin = requireAdminBypass(ctx, "cross-tenant fraud aggregate for super-admin")
await admin.from("scan_events").select("count").gte("scanned_at", since)
```

## Tracking progress

A grep gives a running count:

```bash
# How many files still use the raw admin client?
rg -l 'createAdminClient\(\)' src | wc -l
```

Aim to halve this between audits. Each migrated file should remove the
`createAdminClient()` import or replace it with `requireAdminBypass(ctx, ...)`.

## Sample migrations landed

- `src/app/api/products/mine/route.ts` — list endpoint, classic case.
- `src/app/api/passports/batch-history/route.ts` — already user-scoped, used
  as a reference.

Use these as templates for the rest.
