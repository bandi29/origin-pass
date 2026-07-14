import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole, canManageCounterfeitInvestigations } from "@/lib/rbac"
import {
  assertAlertScoped,
  appendStatusHistory,
  writeAudit,
} from "@/lib/counterfeit-alerts-server"
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
    assigneeId?: string | null
    team?: string | null
    slaHours?: number | null
    priority?: "low" | "medium" | "high" | "critical" | null
  } | null

  if (!body?.alertId) {
    return Response.json({ error: "alertId required" }, { status: 400 })
  }

  const scoped = await assertAlertScoped(user.id, body.alertId)
  if (!scoped) return Response.json({ error: "Not found" }, { status: 404 })

  if (["resolved", "archived", "false_positive"].includes(scoped.status)) {
    return Response.json({ error: "Cannot assign a closed alert." }, { status: 400 })
  }

  const admin = createAdminClient()
  const ip = getRequestIp(request)
  const fromStatus = scoped.status
  const nextStatus = fromStatus === "new" ? "investigating" : fromStatus

  const slaHours = body.slaHours ?? null
  const slaDue =
    slaHours != null && slaHours > 0
      ? new Date(Date.now() + slaHours * 3600 * 1000).toISOString()
      : null

  const patch: Record<string, unknown> = {
    assigned_to: body.assigneeId ?? null,
    assigned_team: body.team?.trim() || null,
    sla_due_at: slaDue,
    status: nextStatus,
  }
  if (body.priority != null) patch.priority = body.priority

  await admin.from("counterfeit_alerts").update(patch).eq("id", body.alertId)

  await admin.from("alert_assignments").insert({
    alert_id: body.alertId,
    assignee_id: body.assigneeId ?? null,
    team: body.team?.trim() || null,
    sla_due_at: slaDue,
    assigned_by: user.id,
  })

  if (nextStatus !== fromStatus) {
    await appendStatusHistory(body.alertId, fromStatus, nextStatus, user.id, "Assignment / triage", {
      assignee: body.assigneeId,
      ip,
    })
  }

  await writeAudit(user.id, "counterfeit_alert_assign", body.alertId, {
    assignee: body.assigneeId,
    team: body.team,
    ip,
  })

  return Response.json({ success: true })
}
