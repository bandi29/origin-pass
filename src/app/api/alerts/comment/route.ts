import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole, canManageCounterfeitInvestigations } from "@/lib/rbac"
import { assertAlertScoped, writeAudit } from "@/lib/counterfeit-alerts-server"
import { getRequestIp } from "@/lib/alerts-api-helpers"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = await getUserRole(supabase, user.id)
  if (!canManageCounterfeitInvestigations(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    alertId?: string
    body?: string
    attachments?: unknown
    isInternal?: boolean
  } | null

  if (!body?.alertId || !body.body?.trim()) {
    return Response.json({ error: "alertId and body required" }, { status: 400 })
  }

  const scoped = await assertAlertScoped(user.id, body.alertId)
  if (!scoped) return Response.json({ error: "Not found" }, { status: 404 })

  const admin = createAdminClient()
  const ip = getRequestIp(request)

  await admin.from("alert_comments").insert({
    alert_id: body.alertId,
    author_id: user.id,
    body: body.body.trim(),
    attachments: body.attachments ?? null,
    is_internal: body.isInternal !== false,
  })

  await writeAudit(user.id, "counterfeit_alert_comment", body.alertId, { ip })

  return Response.json({ success: true })
}
