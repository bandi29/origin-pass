import { createHash, randomBytes } from "node:crypto"
import { cache } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashIpForStorage } from "@/lib/ip-hash"
import type { OriginPassRole } from "@/lib/rbac"
import {
  ensureOrgRolePermissionsFilled,
  ensureTeamPermissionCatalog,
  STATIC_PERMISSION_KEYS_BY_ROLE_SLUG,
} from "@/lib/team/team-bootstrap-fallback"

export const TEAM_ROLE_SLUGS = ["owner", "admin", "editor", "viewer"] as const
export type TeamRoleSlug = (typeof TEAM_ROLE_SLUGS)[number]

export type TeamContext = {
  organizationId: string
  userId: string
  teamRoleId: string
  teamRoleSlug: string
  isOrgOwner: boolean
  memberStatus: "active" | "suspended"
  permissions: string[]
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex")
}

function effectivePermissions(ctx: Pick<TeamContext, "isOrgOwner" | "permissions">): Set<string> {
  if (ctx.isOrgOwner) {
    return new Set(
      [
        "products.read",
        "products.create",
        "products.edit",
        "products.delete",
        "passports.read",
        "passports.manage",
        "qr.generate",
        "labels.print",
        "analytics.view",
        "verification.view",
        "team.manage",
        "billing.manage",
        "api.manage",
      ],
    )
  }
  return new Set(ctx.permissions)
}

export function teamHasPermission(ctx: TeamContext | null, key: string): boolean {
  if (!ctx || ctx.memberStatus !== "active") return false
  return effectivePermissions(ctx).has(key)
}

export function canManageTeam(ctx: TeamContext | null): boolean {
  return teamHasPermission(ctx, "team.manage")
}

export function canManageBilling(ctx: TeamContext | null): boolean {
  return teamHasPermission(ctx, "billing.manage")
}

/** Maps team role slug to legacy originpass_role for backward compatibility. */
export function originPassRoleForTeamSlug(slug: string): OriginPassRole {
  if (slug === "owner") return "tenant_admin"
  if (slug === "admin") return "compliance_manager"
  if (slug === "editor") return "supplier"
  if (slug === "viewer") return "viewer"
  // Custom roles: default to supplier so edit-capable flows stay usable; fine-tune later with permission matrix.
  return "supplier"
}

function legacyRoleText(roleV2: string | null | undefined, legacyRole: string | null | undefined): string {
  return (
    roleV2 ??
    (legacyRole === "owner" ? "tenant_admin" : legacyRole) ??
    "viewer"
  )
}

/** Mirrors SQL migration: first user in org → owner; else map originpass_role to team slug. */
export function inferTeamRoleSlugForUser(params: {
  userId: string
  firstOrgUserId: string | null
  roleV2: string | null | undefined
  legacyRole: string | null | undefined
}): TeamRoleSlug | string {
  if (params.firstOrgUserId && params.userId === params.firstOrgUserId) return "owner"
  const r = legacyRoleText(params.roleV2, params.legacyRole)
  if (r === "super_admin" || r === "tenant_admin") return "admin"
  if (r === "compliance_manager" || r === "fraud_analyst") return "admin"
  if (r === "supplier") return "editor"
  if (r === "viewer") return "viewer"
  return "viewer"
}

async function getFirstUserIdInOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Ensures a row exists in organization_members when team_roles are present.
 * Backfills organizations.owner_id (first member) when it is null.
 */
export async function ensureOrganizationMemberForUser(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data: existing } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) return true

  const { data: roles } = await admin.from("team_roles").select("id, slug").eq("organization_id", organizationId)
  if (!roles?.length) return false

  const { data: orgRow } = await admin
    .from("organizations")
    .select("owner_id")
    .eq("id", organizationId)
    .maybeSingle()

  // Prefer organizations.owner_id as the canonical owner. Fall back to "first user
  // by created_at" only when owner_id has never been set (legacy/migration path).
  let ownerUserId: string | null = (orgRow?.owner_id as string | null) ?? null
  if (!ownerUserId) {
    ownerUserId = await getFirstUserIdInOrganization(admin, organizationId)
    if (ownerUserId) {
      await admin
        .from("organizations")
        .update({ owner_id: ownerUserId, updated_at: new Date().toISOString() })
        .eq("id", organizationId)
    }
  }

  const { data: urow } = await admin
    .from("users")
    .select("role_v2, role")
    .eq("id", userId)
    .maybeSingle()

  const slug = inferTeamRoleSlugForUser({
    userId,
    firstOrgUserId: ownerUserId,
    roleV2: urow?.role_v2 as string | null | undefined,
    legacyRole: urow?.role,
  })

  const role =
    roles.find((x) => x.slug === slug) ??
    roles.find((x) => x.slug === "admin") ??
    roles.find((x) => x.slug === "viewer")

  if (!role) return false

  const { error } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: userId,
    team_role_id: role.id,
    status: "active",
  })

  if (error && error.code !== "23505") {
    console.warn("ensureOrganizationMemberForUser:", error.message)
    return false
  }

  return true
}

export async function seedTeamInfrastructureIfNeeded(
  admin: SupabaseClient,
  organizationId: string,
  ownerUserId: string,
): Promise<void> {
  const { data: existing } = await admin
    .from("team_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle()

  if (existing) return

  const systemRoles: { slug: TeamRoleSlug; name: string; description: string }[] = [
    { slug: "owner", name: "Owner", description: "Full organization access including billing." },
    { slug: "admin", name: "Admin", description: "Manage team, products, passports, and operations." },
    { slug: "editor", name: "Editor", description: "Create catalog data, passports, QR identities, and labels." },
    { slug: "viewer", name: "Viewer", description: "Read-only verification and analytics." },
  ]

  const { data: insertedRoles, error: roleErr } = await admin
    .from("team_roles")
    .insert(
      systemRoles.map((r) => ({
        organization_id: organizationId,
        slug: r.slug,
        name: r.name,
        description: r.description,
        is_system: true,
      })),
    )
    .select("id, slug")

  if (roleErr || !insertedRoles?.length) {
    console.warn("seedTeamInfrastructureIfNeeded roles:", roleErr?.message)
    return
  }

  const { data: templates, error: tplErr } = await admin.from("team_role_templates").select("role_slug, permission_key")

  const permRows: { role_id: string; permission_key: string }[] = []
  if (!tplErr && templates?.length) {
    for (const tr of insertedRoles) {
      for (const t of templates) {
        if (t.role_slug === tr.slug) {
          permRows.push({ role_id: tr.id, permission_key: t.permission_key })
        }
      }
    }
  } else {
    if (tplErr) console.warn("seedTeamInfrastructureIfNeeded templates:", tplErr.message)
    for (const tr of insertedRoles) {
      const keys = STATIC_PERMISSION_KEYS_BY_ROLE_SLUG[tr.slug] ?? []
      for (const permission_key of keys) {
        permRows.push({ role_id: tr.id, permission_key })
      }
    }
  }

  if (permRows.length) {
    const { error: permErr } = await admin.from("team_role_permissions").insert(permRows)
    if (permErr) console.warn("seedTeamInfrastructureIfNeeded permissions:", permErr.message)
  }

  const ownerRoleId = insertedRoles.find((r) => r.slug === "owner")?.id
  if (!ownerRoleId) return

  const { data: orgRow } = await admin
    .from("organizations")
    .select("owner_id, slug")
    .eq("id", organizationId)
    .maybeSingle()

  const primaryOwnerUserId =
    (orgRow?.owner_id as string | null) ??
    (await getFirstUserIdInOrganization(admin, organizationId)) ??
    ownerUserId

  const { error: memErr } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: primaryOwnerUserId,
    team_role_id: ownerRoleId,
    status: "active",
  })
  if (memErr && memErr.code !== "23505") {
    console.warn("seedTeamInfrastructureIfNeeded member:", memErr.message)
  }

  const slug = `org-${organizationId.replace(/-/g, "")}`
  const orgPatch: { owner_id?: string; slug?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (!orgRow?.owner_id) orgPatch.owner_id = primaryOwnerUserId
  const slugEmpty = !orgRow?.slug || String(orgRow.slug).trim().length === 0
  if (slugEmpty) orgPatch.slug = slug

  await admin.from("organizations").update(orgPatch).eq("id", organizationId)
}

export async function logTeamActivity(params: {
  organizationId: string
  actorId: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from("team_activity_logs").insert({
    organization_id: params.organizationId,
    actor_id: params.actorId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? {},
    ip_address: hashIpForStorage(params.ipAddress),
  })
  if (error) console.warn("logTeamActivity:", error.message)
}

/**
 * Per-process bootstrap flags. Once these have run for an organization/user pair
 * in this Node process, they are no-ops on subsequent requests — turning ~6 DB
 * round-trips into 0 for the hot path.
 */
const permissionCatalogReady = { done: false }
const seededOrgs = new Set<string>()
const orgRolePermsFilled = new Set<string>()
const orgMembersEnsured = new Set<string>()

async function bootstrapOnce(admin: SupabaseClient, organizationId: string, userId: string): Promise<void> {
  if (!permissionCatalogReady.done) {
    await ensureTeamPermissionCatalog(admin)
    permissionCatalogReady.done = true
  }
  if (!seededOrgs.has(organizationId)) {
    await seedTeamInfrastructureIfNeeded(admin, organizationId, userId)
    seededOrgs.add(organizationId)
  }
  if (!orgRolePermsFilled.has(organizationId)) {
    await ensureOrgRolePermissionsFilled(admin, organizationId)
    orgRolePermsFilled.add(organizationId)
  }
  const memberKey = `${organizationId}:${userId}`
  if (!orgMembersEnsured.has(memberKey)) {
    await ensureOrganizationMemberForUser(admin, organizationId, userId)
    orgMembersEnsured.add(memberKey)
  }
}

/**
 * Request-scoped cached lookup of the team context. React's `cache()` deduplicates
 * calls within a single rendering/request pass so multiple API helpers that need the
 * same context only pay the cost once.
 */
export const getActorTeamContext = cache(async (userId: string): Promise<TeamContext | null> => {
  const admin = createAdminClient()

  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()

  const organizationId = userRow?.organization_id
  if (!organizationId) return null

  await bootstrapOnce(admin, organizationId, userId)

  const { data: org } = await admin
    .from("organizations")
    .select("id, owner_id")
    .eq("id", organizationId)
    .maybeSingle()

  const { data: member } = await admin
    .from("organization_members")
    .select("team_role_id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle()

  if (!member) return null

  const { data: roleRow } = await admin.from("team_roles").select("slug").eq("id", member.team_role_id).maybeSingle()

  const { data: permRows } = await admin
    .from("team_role_permissions")
    .select("permission_key")
    .eq("role_id", member.team_role_id)

  const permissions = (permRows ?? []).map((r) => r.permission_key)
  const isOrgOwner = org?.owner_id === userId || roleRow?.slug === "owner"

  return {
    organizationId,
    userId,
    teamRoleId: member.team_role_id,
    teamRoleSlug: roleRow?.slug ?? "viewer",
    isOrgOwner,
    memberStatus: member.status === "suspended" ? "suspended" : "active",
    permissions,
  }
})

export async function countActiveOwners(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { data: ownerRole } = await admin
    .from("team_roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("slug", "owner")
    .maybeSingle()

  if (!ownerRole) return 0

  const { count } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("team_role_id", ownerRole.id)
    .eq("status", "active")

  return count ?? 0
}
