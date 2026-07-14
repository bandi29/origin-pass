import { logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx } = actor

  if (!teamHasPermission(ctx, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await routeContext.params
  const supa = admin()

  const { data: inv } = await supa
    .from("team_invitations")
    .select("id, organization_id, status")
    .eq("id", id)
    .maybeSingle()

  if (!inv || inv.organization_id !== ctx.organizationId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (inv.status !== "pending") {
    return Response.json({ error: "Invitation is not pending" }, { status: 400 })
  }

  await supa
    .from("team_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: actor.userId,
    action: "invitation_revoked",
    targetType: "team_invitation",
    targetId: id,
    metadata: {},
    ipAddress: clientIp(request),
  })

  return Response.json({ success: true })
}
