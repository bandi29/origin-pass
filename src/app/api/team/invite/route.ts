import { z } from "zod"
import { siteUrl } from "@/lib/marketing"
import { routing } from "@/i18n/routing"
import { buildTeamInviteEmailHtml, sendTeamInviteEmail } from "@/lib/team/invite-email"
import { generateInviteToken, hashInviteToken, logTeamActivity, teamHasPermission } from "@/lib/team/team-context"
import { admin, clientIp, requireTeamActor } from "@/lib/team/team-api-helpers"

const bodySchema = z.object({
  email: z.string().trim().email(),
  teamRoleSlug: z.string().trim().min(2).max(64),
  message: z.string().max(2000).optional().nullable(),
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

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const supa = admin()

  const slug = parsed.data.teamRoleSlug.toLowerCase()
  const { data: roleRow } = await supa
    .from("team_roles")
    .select("id, slug")
    .eq("organization_id", ctx.organizationId)
    .eq("slug", slug)
    .maybeSingle()

  if (!roleRow) return Response.json({ error: "Role not found" }, { status: 400 })

  if (roleRow.slug === "owner" && !ctx.isOrgOwner) {
    return Response.json({ error: "Only the organization owner can invite another owner." }, { status: 403 })
  }

  const { data: org } = await supa.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle()
  const { data: inviter } = await supa.from("users").select("name, email").eq("id", userId).maybeSingle()

  const { data: existingMember } = await supa
    .from("users")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .ilike("email", email)
    .maybeSingle()

  if (existingMember) {
    return Response.json({ error: "That email already belongs to a member of this organization." }, { status: 409 })
  }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error: invErr } = await supa
    .from("team_invitations")
    .insert({
      organization_id: ctx.organizationId,
      email,
      team_role_id: roleRow.id,
      token_hash: tokenHash,
      invited_by: userId,
      message: parsed.data.message ?? null,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (invErr) {
    if (invErr.code === "23505") {
      return Response.json({ error: "A pending invitation already exists for this email." }, { status: 409 })
    }
    console.warn("team invite insert:", invErr.message)
    return Response.json({ error: "Could not create invitation" }, { status: 500 })
  }

  const base = siteUrl().replace(/\/$/, "")
  const acceptUrl = `${base}/${routing.defaultLocale}/join?token=${encodeURIComponent(token)}`

  const html = buildTeamInviteEmailHtml({
    organizationName: org?.name ?? "Your organization",
    inviterName: inviter?.name?.trim() || inviter?.email || "A teammate",
    acceptUrl,
    expiresAtIso: expiresAt,
    optionalMessage: parsed.data.message,
  })

  const emailResult = await sendTeamInviteEmail({
    to: email,
    subject: `You’re invited to ${org?.name ?? "OriginPass"}`,
    html,
  })

  await logTeamActivity({
    organizationId: ctx.organizationId,
    actorId: userId,
    action: "member_invited",
    targetType: "team_invitation",
    targetId: invite.id,
    metadata: { email, teamRoleSlug: roleRow.slug, emailDispatched: emailResult.ok },
    ipAddress: clientIp(request),
  })

  return Response.json({
    invitationId: invite.id,
    acceptUrl,
    expiresAt,
    emailWarning: emailResult.ok ? null : "error" in emailResult ? emailResult.error : null,
  })
}
