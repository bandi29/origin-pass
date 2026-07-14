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
    note?: string
    target?: string | null
  } | null

  if (!body?.alertId) {
    return Response.json({ error: "alertId required" }, { status: 400 })
  }

  const scoped = await assertAlertScoped(user.id, body.alertId)
  if (!scoped) return Response.json({ error: "Not found" }, { status: 404 })

  if (["resolved", "archived", "false_positive"].includes(scoped.status)) {
    return Response.json({ error: "Cannot escalate a closed alert." }, { status: 400 })
  }

  const admin = createAdminClient()
  const ip = getRequestIp(request)
  const fromStatus = scoped.status

  await admin
    .from("counterfeit_alerts")
    .update({
      status: "escalated",
      priority: "critical",
    })
    .eq("id", body.alertId)

  await appendStatusHistory(
    body.alertId,
    fromStatus,
    "escalated",
    user.id,
    body.note?.trim() || "Escalated for compliance / management review",
    { target: body.target ?? "compliance", ip },
  )

  const { data: inv } = await admin
    .from("fraud_investigations")
    .select("id")
    .eq("alert_id", body.alertId)
    .maybeSingle()
  if (inv) {
    await admin
      .from("fraud_investigations")
      .update({
        escalation_target: body.target ?? "compliance",
        metadata: { escalated_at: new Date().toISOString(), ip },
      })
      .eq("alert_id", body.alertId)
  } else {
    await admin.from("fraud_investigations").insert({
      alert_id: body.alertId,
      case_label: `Case ${body.alertId.slice(0, 8)}`,
      escalation_target: body.target ?? "compliance",
      metadata: { escalated_at: new Date().toISOString(), ip },
    })
  }

  await writeAudit(user.id, "counterfeit_alert_escalate", body.alertId, {
    note: body.note,
    ip,
  })

  return Response.json({ success: true })
}
