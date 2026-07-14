import { createAdminClient } from "@/lib/supabase/admin"
import type { TeamContext } from "@/lib/team/team-context"
import { getActorTeamContext } from "@/lib/team/team-context"

export type TeamMemberRow = {
  id: string
  kind: "member"
  userId: string
  name: string | null
  email: string | null
  roleSlug: string
  roleName: string
  status: "active" | "suspended"
  lastSeenAt: string | null
  joinedAt: string
}

export type TeamInviteRow = {
  id: string
  kind: "invitation"
  email: string
  roleSlug: string
  roleName: string
  status: string
  createdAt: string
  expiresAt: string
  invitedByName: string | null
}

export type TeamRoleRow = {
  id: string
  slug: string
  name: string
  description: string | null
  isSystem: boolean
  memberCount: number
  permissionKeys: string[]
}

export type TeamActivityRow = {
  id: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown>
  ipAddress: string | null
  createdAt: string
}

export type TeamDashboardPayload = {
  context: TeamContext
  organization: {
    id: string
    name: string
    slug: string | null
    logo_url: string | null
    subscription_plan: string | null
    owner_id: string | null
    settings: Record<string, unknown>
  }
  members: TeamMemberRow[]
  invitations: TeamInviteRow[]
  roles: TeamRoleRow[]
  permissionsCatalog: { key: string; description: string; category: string }[]
  activity: TeamActivityRow[]
  pendingInviteCount: number
  activeMemberCount: number
}

export async function loadTeamDashboardData(userId: string): Promise<TeamDashboardPayload | null> {
  const admin = createAdminClient()
  const ctx = await getActorTeamContext(userId)
  if (!ctx) return null

  await admin
    .from("organization_members")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", userId)

  const orgId = ctx.organizationId

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, logo_url, subscription_plan, owner_id, settings")
    .eq("id", orgId)
    .maybeSingle()

  if (!org) return null

  const { data: roles } = await admin
    .from("team_roles")
    .select("id, slug, name, description, is_system")
    .eq("organization_id", orgId)
    .order("is_system", { ascending: false })
    .order("slug")

  const roleList = roles ?? []
  const roleIds = roleList.map((r) => r.id)
  const roleById = new Map(roleList.map((r) => [r.id, r]))

  const { data: permLinks } =
    roleIds.length > 0
      ? await admin.from("team_role_permissions").select("role_id, permission_key").in("role_id", roleIds)
      : { data: [] as { role_id: string; permission_key: string }[] }

  const permsByRole = new Map<string, string[]>()
  for (const row of permLinks ?? []) {
    const arr = permsByRole.get(row.role_id) ?? []
    arr.push(row.permission_key)
    permsByRole.set(row.role_id, arr)
  }

  const { data: memberRows } = await admin
    .from("organization_members")
    .select("id, user_id, team_role_id, status, joined_at, last_seen_at")
    .eq("organization_id", orgId)

  const memberUserIds = [...new Set((memberRows ?? []).map((m) => m.user_id))]
  const { data: memberUsers } =
    memberUserIds.length > 0
      ? await admin.from("users").select("id, name, email").in("id", memberUserIds)
      : { data: [] as { id: string; name: string | null; email: string | null }[] }

  const userById = new Map((memberUsers ?? []).map((u) => [u.id, u]))

  const members: TeamMemberRow[] = (memberRows ?? []).map((m) => {
    const u = userById.get(m.user_id)
    const tr = roleById.get(m.team_role_id)
    return {
      id: m.id,
      kind: "member" as const,
      userId: m.user_id,
      name: u?.name ?? null,
      email: u?.email ?? null,
      roleSlug: tr?.slug ?? "viewer",
      roleName: tr?.name ?? "Viewer",
      status: m.status === "suspended" ? "suspended" : "active",
      lastSeenAt: m.last_seen_at ?? null,
      joinedAt: m.joined_at,
    }
  })

  const { data: invRows } = await admin
    .from("team_invitations")
    .select("id, email, status, created_at, expires_at, invited_by, team_role_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  const inviterIds = [...new Set((invRows ?? []).map((r) => r.invited_by).filter(Boolean) as string[])]
  const { data: inviterUsers } =
    inviterIds.length > 0
      ? await admin.from("users").select("id, name").in("id", inviterIds)
      : { data: [] as { id: string; name: string | null }[] }

  const inviterById = new Map((inviterUsers ?? []).map((u) => [u.id, u]))

  const invitations: TeamInviteRow[] = (invRows ?? []).map((r) => {
    const tr = roleById.get(r.team_role_id)
    const inviter = r.invited_by ? inviterById.get(r.invited_by) : undefined
    return {
      id: r.id,
      kind: "invitation" as const,
      email: r.email,
      roleSlug: tr?.slug ?? "viewer",
      roleName: tr?.name ?? "Viewer",
      status: r.status,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      invitedByName: inviter?.name ?? null,
    }
  })

  const memberCountByRole = new Map<string, number>()
  for (const m of members) {
    const role = roleList.find((r) => r.slug === m.roleSlug)
    if (!role) continue
    memberCountByRole.set(role.id, (memberCountByRole.get(role.id) ?? 0) + 1)
  }

  const rolesOut: TeamRoleRow[] = roleList.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    memberCount: memberCountByRole.get(r.id) ?? 0,
    permissionKeys: permsByRole.get(r.id) ?? [],
  }))

  const { data: catalog } = await admin.from("team_permissions").select("key, description, category").order("category").order("key")

  const { data: actRows } = await admin
    .from("team_activity_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, ip_address, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(120)

  const actorIds = [...new Set((actRows ?? []).map((a) => a.actor_id).filter(Boolean) as string[])]
  const { data: actorUsers } =
    actorIds.length > 0
      ? await admin.from("users").select("id, name, email").in("id", actorIds)
      : { data: [] as { id: string; name: string | null; email: string | null }[] }

  const actorById = new Map((actorUsers ?? []).map((u) => [u.id, u]))

  const activity: TeamActivityRow[] = (actRows ?? []).map((a) => {
    const actor = a.actor_id ? actorById.get(a.actor_id) : undefined
    return {
      id: a.id,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
      action: a.action,
      targetType: a.target_type,
      targetId: a.target_id,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
      ipAddress: a.ip_address,
      createdAt: a.created_at,
    }
  })

  const pendingInviteCount = invitations.filter((i) => i.status === "pending").length
  const activeMemberCount = members.filter((m) => m.status === "active").length

  return {
    context: ctx,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
      subscription_plan: org.subscription_plan,
      owner_id: org.owner_id,
      settings: (org.settings as Record<string, unknown>) ?? {},
    },
    members,
    invitations,
    roles: rolesOut,
    permissionsCatalog: (catalog ?? []).map((c) => ({ key: c.key, description: c.description, category: c.category })),
    activity,
    pendingInviteCount,
    activeMemberCount,
  }
}
