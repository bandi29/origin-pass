import { z } from "zod"
import { logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

const patchSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  logo_url: z
    .union([z.string().url().max(2000), z.literal(""), z.null()])
    .optional(),
  settings: z
    .object({
      require2fa: z.boolean().optional(),
      sessionTimeoutMinutes: z.number().int().min(5).max(10080).optional(),
      inviteRestrictions: z.enum(["any_email", "domain_allowlist"]).optional(),
      allowedDomains: z.array(z.string().max(200)).max(32).optional(),
      ssoPlaceholder: z.string().max(500).optional(),
    })
    .partial()
    .optional(),
})

export async function PATCH(request: Request) {
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

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const supa = admin()
  const { data: org } = await supa.from("organizations").select("settings").eq("id", ctx.organizationId).maybeSingle()
  const prevSettings = (org?.settings as Record<string, unknown>) ?? {}

  const next: Record<string, unknown> = { ...prevSettings }
  if (parsed.data.settings) {
    Object.assign(next, parsed.data.settings)
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name
  if (parsed.data.logo_url !== undefined) {
    updatePayload.logo_url =
      parsed.data.logo_url === "" || parsed.data.logo_url === null ? null : parsed.data.logo_url
  }
  if (parsed.data.settings !== undefined) updatePayload.settings = next

  const { error } = await supa.from("organizations").update(updatePayload).eq("id", ctx.organizationId)
  if (error) {
    console.warn("org patch:", error.message)
    return Response.json({ error: "Could not update organization" }, { status: 500 })
  }

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: userId,
    action: "org_settings_updated",
    targetType: "organization",
    targetId: ctx.organizationId,
    metadata: { keys: Object.keys(parsed.data) },
    ipAddress: clientIp(request),
  })

  return Response.json({ success: true })
}
