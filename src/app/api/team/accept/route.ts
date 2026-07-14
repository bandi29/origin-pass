import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { hashInviteToken, logTeamActivity, originPassRoleForTeamSlug } from "@/lib/team/team-context"
import { admin, clientIp } from "@/lib/team/team-api-helpers"

const bodySchema = z.object({
  token: z.string().min(16),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || !user.email) {
    return Response.json({ error: "Sign in with the invited email to accept." }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Invalid token" }, { status: 400 })
  }

  const tokenHash = hashInviteToken(parsed.data.token)
  const supa = admin()

  const { data: invite } = await supa
    .from("team_invitations")
    .select("id, organization_id, email, team_role_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (!invite || invite.status !== "pending") {
    return Response.json({ error: "Invitation not found or already used." }, { status: 404 })
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supa.from("team_invitations").update({ status: "expired" }).eq("id", invite.id)
    return Response.json({ error: "This invitation has expired." }, { status: 410 })
  }

  const email = user.email.trim().toLowerCase()
  if (email !== invite.email.trim().toLowerCase()) {
    await logTeamActivity({
      organizationId: invite.organization_id,
      actorId: user.id,
      action: "suspicious_invite_accept_mismatch",
      targetType: "team_invitation",
      targetId: invite.id,
      metadata: { expected: invite.email, actualDomain: email.split("@")[1] },
      ipAddress: clientIp(request),
    })
    return Response.json(
      { error: "Signed-in email does not match the invitation. Switch accounts or ask for a new invite." },
      { status: 403 },
    )
  }

  const { data: existingUser } = await supa.from("users").select("organization_id").eq("id", user.id).maybeSingle()

  if (existingUser?.organization_id && existingUser.organization_id !== invite.organization_id) {
    return Response.json(
      { error: "You already belong to another organization. Leave it before accepting this invite." },
      { status: 409 },
    )
  }

  const { data: roleRow } = await supa.from("team_roles").select("slug").eq("id", invite.team_role_id).maybeSingle()
  const slug = roleRow?.slug ?? "viewer"
  const roleV2 = originPassRoleForTeamSlug(slug)

  const { error: upUserErr } = await supa
    .from("users")
    .update({
      organization_id: invite.organization_id,
      role_v2: roleV2,
    })
    .eq("id", user.id)

  if (upUserErr) {
    console.warn("accept invite user update:", upUserErr.message)
    return Response.json({ error: "Could not attach your account to the organization." }, { status: 500 })
  }

  const { error: memErr } = await supa.from("organization_members").upsert(
    {
      organization_id: invite.organization_id,
      user_id: user.id,
      team_role_id: invite.team_role_id,
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  )

  if (memErr) {
    console.warn("accept invite member upsert:", memErr.message)
    return Response.json({ error: "Could not add you to the team roster." }, { status: 500 })
  }

  await supa
    .from("team_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)

  await logTeamActivity({
    organizationId: invite.organization_id,
    actorId: user.id,
    action: "invitation_accepted",
    targetType: "team_invitation",
    targetId: invite.id,
    metadata: { email },
    ipAddress: clientIp(request),
  })

  return Response.json({ success: true, organizationId: invite.organization_id })
}
