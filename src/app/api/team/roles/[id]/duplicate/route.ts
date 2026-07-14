import { randomBytes } from "node:crypto"
import { z } from "zod"
import { logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

const bodySchema = z.object({
  name: z.string().trim().min(2).max(80),
})

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx, userId } = actor

  if (!teamHasPermission(ctx, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: sourceId } = await routeContext.params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supa = admin()
  const { data: source } = await supa
    .from("team_roles")
    .select("id, organization_id, description, is_system")
    .eq("id", sourceId)
    .maybeSingle()

  if (!source || source.organization_id !== ctx.organizationId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { data: perms } = await supa.from("team_role_permissions").select("permission_key").eq("role_id", sourceId)
  const keys = (perms ?? []).map((p) => p.permission_key)
  if (!keys.length) return Response.json({ error: "Source role has no permissions" }, { status: 400 })

  const slug = `custom-${randomBytes(6).toString("hex")}`

  const { data: role, error: rErr } = await supa
    .from("team_roles")
    .insert({
      organization_id: ctx.organizationId,
      slug,
      name: parsed.data.name,
      description: source.description,
      is_system: false,
    })
    .select("id")
    .single()

  if (rErr || !role) {
    console.warn("duplicate role:", rErr?.message)
    return Response.json({ error: "Could not duplicate role" }, { status: 500 })
  }

  const { error: pErr } = await supa
    .from("team_role_permissions")
    .insert(keys.map((permission_key) => ({ role_id: role.id, permission_key })))

  if (pErr) {
    await supa.from("team_roles").delete().eq("id", role.id)
    return Response.json({ error: "Could not copy permissions" }, { status: 500 })
  }

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: userId,
    action: "custom_role_duplicated",
    targetType: "team_role",
    targetId: role.id,
    metadata: { fromRoleId: sourceId, slug },
    ipAddress: clientIp(request),
  })

  return Response.json({ id: role.id, slug })
}
