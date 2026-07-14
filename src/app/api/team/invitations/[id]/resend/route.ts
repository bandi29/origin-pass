import { siteUrl } from "@/lib/marketing"
import { routing } from "@/i18n/routing"
import { buildTeamInviteEmailHtml, sendTeamInviteEmail } from "@/lib/team/invite-email"
import { generateInviteToken, hashInviteToken, logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const actor = await requireTeamActor()
  if (actor instanceof Response) return actor
  const { ctx, userId } = actor

  if (!teamHasPermission(ctx, "team.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await routeContext.params
  const supa = admin()

  const { data: inv } = await supa
    .from("team_invitations")
    .select("id, organization_id, email, status, message, team_role_id")
    .eq("id", id)
    .maybeSingle()

  if (!inv || inv.organization_id !== ctx.organizationId) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (inv.status !== "pending") {
    return Response.json({ error: "Only pending invitations can be resent" }, { status: 400 })
  }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: upErr } = await supa
    .from("team_invitations")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", id)

  if (upErr) {
    console.warn("invite resend:", upErr.message)
    return Response.json({ error: "Could not refresh invitation" }, { status: 500 })
  }

  const { data: org } = await supa.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle()
  const { data: inviter } = await supa.from("users").select("name, email").eq("id", userId).maybeSingle()
  const { data: roleRow } = await supa.from("team_roles").select("slug").eq("id", inv.team_role_id).maybeSingle()

  const base = siteUrl().replace(/\/$/, "")
  const acceptUrl = `${base}/${routing.defaultLocale}/join?token=${encodeURIComponent(token)}`

  const html = buildTeamInviteEmailHtml({
    organizationName: org?.name ?? "Your organization",
    inviterName: inviter?.name?.trim() || inviter?.email || "A teammate",
    acceptUrl,
    expiresAtIso: expiresAt,
    optionalMessage: inv.message,
  })

  const emailResult = await sendTeamInviteEmail({
    to: inv.email,
    subject: `Reminder: invitation to ${org?.name ?? "OriginPass"}`,
    html,
  })

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: userId,
    action: "invitation_resent",
    targetType: "team_invitation",
    targetId: id,
    metadata: { email: inv.email, teamRoleSlug: roleRow?.slug, emailDispatched: emailResult.ok },
    ipAddress: clientIp(request),
  })

  return Response.json({
    acceptUrl,
    expiresAt,
    token,
    emailWarning: emailResult.ok ? null : "error" in emailResult ? emailResult.error : null,
  })
}
