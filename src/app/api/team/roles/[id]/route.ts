import { z } from "zod"
import { logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  permissionKeys: z.array(z.string().max(120)).min(1).max(40).optional(),
})

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx, userId } = actor

  if (!teamHasPermission(ctx, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await routeContext.params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supa = admin()
  const { data: role } = await supa
    .from("team_roles")
    .select("id, organization_id, is_system, slug")
    .eq("id", id)
    .maybeSingle()

  if (!role || role.organization_id !== ctx.organizationId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (role.is_system) {
    return Response.json({ error: "System roles cannot be edited here." }, { status: 403 })
  }

  if (parsed.data.name !== undefined || parsed.data.description !== undefined) {
    const { error } = await supa
      .from("team_roles")
      .update({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      })
      .eq("id", id)

    if (error) {
      console.warn("role patch name:", error.message)
      return Response.json({ error: "Could not update role" }, { status: 500 })
    }
  }

  if (parsed.data.permissionKeys) {
    const { data: validPerms } = await supa.from("team_permissions").select("key").in("key", parsed.data.permissionKeys)
    const validSet = new Set((validPerms ?? []).map((p) => p.key))
    const keys = parsed.data.permissionKeys.filter((k) => validSet.has(k))
    if (!keys.length) return Response.json({ error: "No valid permissions" }, { status: 400 })

    await supa.from("team_role_permissions").delete().eq("role_id", id)
    const { error: insErr } = await supa
      .from("team_role_permissions")
      .insert(keys.map((permission_key) => ({ role_id: id, permission_key })))

    if (insErr) {
      console.warn("role patch perms:", insErr.message)
      return Response.json({ error: "Could not update permissions" }, { status: 500 })
    }

    await logTeamActivity({
      organizationId: ctx.organizationId,
      actorId: userId,
      action: "permission_update",
      targetType: "team_role",
      targetId: id,
      metadata: { slug: role.slug },
      ipAddress: clientIp(request),
    })
  }

  return Response.json({ success: true })
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx, userId } = actor

  if (!teamHasPermission(ctx, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await routeContext.params
  const supa = admin()

  const { data: role } = await supa
    .from("team_roles")
    .select("id, organization_id, is_system")
    .eq("id", id)
    .maybeSingle()

  if (!role || role.organization_id !== ctx.organizationId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (role.is_system) {
    return Response.json({ error: "System roles cannot be deleted." }, { status: 403 })
  }

  const { count } = await supa
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("team_role_id", id)

  if ((count ?? 0) > 0) {
    return Response.json({ error: "Reassign members before deleting this role." }, { status: 409 })
  }

  const { error } = await supa.from("team_roles").delete().eq("id", id)
  if (error) {
    console.warn("role delete:", error.message)
    return Response.json({ error: "Could not delete role" }, { status: 500 })
  }

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: userId,
    action: "custom_role_deleted",
    targetType: "team_role",
    targetId: id,
    metadata: {},
    ipAddress: clientIp(request),
  })

  return Response.json({ success: true })
}
