import { z } from "zod"
import {
  countActiveOwners,
  logTeamActivity,
  originPassRoleForTeamSlug,
  teamHasPermission,
} from "@/lib/team/team-context"
import { admin, requireTeamActor, clientIp } from "@/lib/team/team-api-helpers"

const patchSchema = z
  .object({
    teamRoleSlug: z.string().trim().min(2).max(64).optional(),
    suspended: z.boolean().optional(),
  })
  .refine((b) => b.teamRoleSlug !== undefined || b.suspended !== undefined, { message: "No changes" })

export async function PATCH(request: Request, routeContext: { params: Promise<{ userId: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx: team, userId: actorId } = actor

  if (!teamHasPermission(team, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId: targetId } = await routeContext.params
  if (!targetId) return Response.json({ error: "Missing user" }, { status: 400 })

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

  const { data: org } = await supa.from("organizations").select("owner_id").eq("id", team.organizationId).maybeSingle()

  if (parsed.data.suspended === true && org?.owner_id === targetId) {
    return Response.json({ error: "Cannot suspend the organization owner." }, { status: 403 })
  }


  const { data: targetMember } = await supa
    .from("organization_members")
    .select("id, team_role_id")
    .eq("organization_id", team.organizationId)
    .eq("user_id", targetId)
    .maybeSingle()

  if (!targetMember) return Response.json({ error: "Member not found" }, { status: 404 })

  const { data: currentRole } = await supa.from("team_roles").select("slug").eq("id", targetMember.team_role_id).maybeSingle()

  if (parsed.data.teamRoleSlug) {
    const slug = parsed.data.teamRoleSlug.toLowerCase()
    const { data: newRole } = await supa
      .from("team_roles")
      .select("id, slug")
      .eq("organization_id", team.organizationId)
      .eq("slug", slug)
      .maybeSingle()

    if (!newRole) return Response.json({ error: "Role not found" }, { status: 400 })

    if (newRole.slug === "owner" && !team.isOrgOwner) {
      return Response.json({ error: "Only the organization owner can assign the Owner team role." }, { status: 403 })
    }

    if (currentRole?.slug === "owner" && parsed.data.teamRoleSlug !== "owner") {
      const owners = await countActiveOwners(supa, team.organizationId)
      if (owners <= 1) {
        return Response.json({ error: "Cannot remove the last Owner from the organization." }, { status: 403 })
      }
    }

    const { error: upErr } = await supa
      .from("organization_members")
      .update({ team_role_id: newRole.id })
      .eq("id", targetMember.id)

    if (upErr) {
      console.warn("member role update:", upErr.message)
      return Response.json({ error: "Could not update role" }, { status: 500 })
    }

    const roleV2 = originPassRoleForTeamSlug(newRole.slug)
    await supa.from("users").update({ role_v2: roleV2 }).eq("id", targetId)

    await logTeamActivity({
      organizationId: team.organizationId,
      actorId: actorId,
      action: "role_changed",
      targetType: "user",
      targetId: targetId,
      metadata: { from: currentRole?.slug, to: newRole.slug },
      ipAddress: clientIp(request),
    })
  }

  if (parsed.data.suspended !== undefined) {
    const { error: susErr } = await supa
      .from("organization_members")
      .update({ status: parsed.data.suspended ? "suspended" : "active" })
      .eq("id", targetMember.id)

    if (susErr) {
      console.warn("member suspend:", susErr.message)
      return Response.json({ error: "Could not update status" }, { status: 500 })
    }

    await logTeamActivity({
      organizationId: team.organizationId,
      actorId: actorId,
      action: parsed.data.suspended ? "member_suspended" : "member_reactivated",
      targetType: "user",
      targetId: targetId,
      metadata: {},
      ipAddress: clientIp(request),
    })
  }

  return Response.json({ success: true })
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ userId: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx: team, userId: actorId } = actor

  if (!teamHasPermission(team, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId: targetId } = await routeContext.params
  if (!targetId) return Response.json({ error: "Missing user" }, { status: 400 })

  const supa = admin()

  const { data: org } = await supa.from("organizations").select("owner_id").eq("id", team.organizationId).maybeSingle()
  if (org?.owner_id === targetId) {
    return Response.json({ error: "Transfer ownership before removing the organization owner." }, { status: 403 })
  }

  const { data: targetMember } = await supa
    .from("organization_members")
    .select("id, team_role_id")
    .eq("organization_id", team.organizationId)
    .eq("user_id", targetId)
    .maybeSingle()

  if (!targetMember) return Response.json({ error: "Member not found" }, { status: 404 })

  const { data: currentRole } = await supa.from("team_roles").select("slug").eq("id", targetMember.team_role_id).maybeSingle()
  if (currentRole?.slug === "owner") {
    const owners = await countActiveOwners(supa, team.organizationId)
    if (owners <= 1) {
      return Response.json({ error: "Cannot remove the last Owner." }, { status: 403 })
    }
  }

  const { error: delErr } = await supa.from("organization_members").delete().eq("id", targetMember.id)
  if (delErr) {
    console.warn("member delete:", delErr.message)
    return Response.json({ error: "Could not remove member" }, { status: 500 })
  }

  await supa.from("users").update({ organization_id: null, role_v2: "viewer" }).eq("id", targetId)

  await logTeamActivity({
    organizationId: team.organizationId,
    actorId: actorId,
    action: "member_removed",
    targetType: "user",
    targetId: targetId,
    metadata: {},
    ipAddress: clientIp(request),
  })

  return Response.json({ success: true })
}
