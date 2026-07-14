import type { SupabaseClient } from "@supabase/supabase-js"

/** Mirrors `20260426220000_team_management.sql` so Team works if templates/catalog rows are missing. */
export const TEAM_PERMISSION_CATALOG: { key: string; description: string; category: string }[] = [
  { key: "products.read", description: "View products and catalog data.", category: "products" },
  { key: "products.create", description: "Create products.", category: "products" },
  { key: "products.edit", description: "Edit products.", category: "products" },
  { key: "products.delete", description: "Delete products.", category: "products" },
  { key: "passports.read", description: "View product passports.", category: "passports" },
  { key: "passports.manage", description: "Create, edit, and publish passports.", category: "passports" },
  { key: "qr.generate", description: "Generate QR identities.", category: "qr" },
  { key: "labels.print", description: "Print labels and export print jobs.", category: "labels" },
  { key: "analytics.view", description: "View analytics and reporting.", category: "analytics" },
  { key: "verification.view", description: "Run read-only verification flows.", category: "verification" },
  { key: "team.manage", description: "Invite members, roles, and invitations.", category: "team" },
  { key: "billing.manage", description: "Manage billing and subscription.", category: "billing" },
  { key: "api.manage", description: "Create and revoke API keys.", category: "api" },
]

const ALL_PERM_KEYS = TEAM_PERMISSION_CATALOG.map((p) => p.key)

export const STATIC_PERMISSION_KEYS_BY_ROLE_SLUG: Record<string, string[]> = {
  owner: [...ALL_PERM_KEYS],
  admin: ALL_PERM_KEYS.filter((k) => k !== "billing.manage"),
  editor: [
    "products.create",
    "products.edit",
    "passports.manage",
    "qr.generate",
    "labels.print",
    "products.read",
    "passports.read",
  ],
  viewer: ["products.read", "passports.read", "verification.view", "analytics.view"],
}

/**
 * Idempotent: ensures global permission rows exist (required for role_permissions FKs).
 */
export async function ensureTeamPermissionCatalog(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.from("team_permissions").upsert(TEAM_PERMISSION_CATALOG, {
    onConflict: "key",
    ignoreDuplicates: true,
  })
  if (error) {
    console.warn("[team] ensureTeamPermissionCatalog:", error.message)
  }
}

/**
 * For each system/custom role in the org with zero permissions, attach the static matrix by slug.
 * Fixes partial migrations and seeds that bailed before `team_role_permissions` were written.
 */
export async function ensureOrgRolePermissionsFilled(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { data: roles, error: rErr } = await admin
    .from("team_roles")
    .select("id, slug")
    .eq("organization_id", organizationId)

  if (rErr || !roles?.length) {
    if (rErr) console.warn("[team] ensureOrgRolePermissionsFilled roles:", rErr.message)
    return
  }

  for (const role of roles) {
    const { count, error: cErr } = await admin
      .from("team_role_permissions")
      .select("role_id", { count: "exact", head: true })
      .eq("role_id", role.id)

    if (cErr) continue
    if ((count ?? 0) > 0) continue

    const keys = STATIC_PERMISSION_KEYS_BY_ROLE_SLUG[role.slug]
    if (!keys?.length) continue

    const { error: iErr } = await admin.from("team_role_permissions").insert(
      keys.map((permission_key) => ({ role_id: role.id, permission_key })),
    )
    if (iErr) console.warn("[team] ensureOrgRolePermissionsFilled insert:", role.slug, iErr.message)
  }
}
