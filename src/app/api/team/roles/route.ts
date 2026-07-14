import { randomBytes } from "node:crypto"
import { z } from "zod"
import { logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

const postSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  permissionKeys: z.array(z.string().max(120)).min(1).max(40),
})

export async function POST(request: Request) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx, userId } = actor

  if (!teamHasPermission(ctx, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supa = admin()

  const { data: validPerms } = await supa.from("team_permissions").select("key").in("key", parsed.data.permissionKeys)
  const validSet = new Set((validPerms ?? []).map((p) => p.key))
  const keys = parsed.data.permissionKeys.filter((k) => validSet.has(k))
  if (!keys.length) return Response.json({ error: "No valid permissions" }, { status: 400 })

  const slug = `custom-${randomBytes(6).toString("hex")}`

  const { data: role, error: rErr } = await supa
    .from("team_roles")
    .insert({
      organization_id: ctx.organizationId,
      slug,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      is_system: false,
    })
    .select("id")
    .single()

  if (rErr || !role) {
    console.warn("custom role insert:", rErr?.message)
    return Response.json({ error: "Could not create role" }, { status: 500 })
  }

  const permRows = keys.map((permission_key) => ({ role_id: role.id, permission_key }))
  const { error: pErr } = await supa.from("team_role_permissions").insert(permRows)
  if (pErr) {
    await supa.from("team_roles").delete().eq("id", role.id)
    console.warn("custom role perms:", pErr.message)
    return Response.json({ error: "Could not attach permissions" }, { status: 500 })
  }

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: userId,
    action: "custom_role_created",
    targetType: "team_role",
    targetId: role.id,
    metadata: { name: parsed.data.name, slug },
    ipAddress: clientIp(request),
  })

  return Response.json({ id: role.id, slug })
}
