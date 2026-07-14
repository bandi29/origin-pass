import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole, canManageCounterfeitInvestigations } from "@/lib/rbac"
import {
  assertAlertScoped,
  appendStatusHistory,
  writeAudit,
} from "@/lib/counterfeit-alerts-server"
import { loadProductRisk } from "@/lib/counterfeit-alerts-mutations"
import { clampRisk } from "@/lib/counterfeit-alerts-risk"
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
    flagPassport?: boolean
  } | null

  if (!body?.alertId) {
    return Response.json({ error: "alertId required" }, { status: 400 })
  }

  const scoped = await assertAlertScoped(user.id, body.alertId)
  if (!scoped) return Response.json({ error: "Not found" }, { status: 404 })

  if (scoped.status === "archived" || scoped.status === "resolved") {
    return Response.json({ error: "Alert is already closed." }, { status: 400 })
  }

  const admin = createAdminClient()
  const ip = getRequestIp(request)
  const fromStatus = scoped.status

  const prod = await loadProductRisk(scoped.product_id)
  if (!prod) return Response.json({ error: "Product not found" }, { status: 404 })

  const riskAfter = clampRisk(prod.risk_score + 60)

  await admin
    .from("products")
    .update({
      risk_score: riskAfter,
      verification_status: "high_risk",
    })
    .eq("id", scoped.product_id)

  await admin.from("verification_events").insert({
    product_id: scoped.product_id,
    organization_id: prod.organization_id,
    rule_id: null,
    event_type: "counterfeit_confirmed",
    event_message: body.note?.trim() || "Counterfeit activity confirmed from investigation center.",
    score_change: riskAfter - prod.risk_score,
    risk_before: prod.risk_score,
    risk_after: riskAfter,
    metadata_json: { alert_id: body.alertId, actor: user.id, ip },
  })

  if (body.flagPassport !== false && scoped.passport_id) {
    await admin
      .from("passports")
      .update({ status: "counterfeit_flagged" })
      .eq("id", scoped.passport_id)
  }

  await admin
    .from("counterfeit_alerts")
    .update({
      status: "confirmed_fraud",
      investigation_notes: body.note?.trim() || null,
      risk_score_snapshot: riskAfter,
      verification_confidence: Math.max(0, 100 - riskAfter),
    })
    .eq("id", body.alertId)

  await appendStatusHistory(
    body.alertId,
    fromStatus,
    "confirmed_fraud",
    user.id,
    body.note?.trim() || "Fraud confirmed — manual review",
    { ip, passport_flagged: body.flagPassport !== false },
  )

  await writeAudit(user.id, "counterfeit_alert_confirm_fraud", body.alertId, {
    risk_after: riskAfter,
    ip,
  })

  return Response.json({ success: true, riskScore: riskAfter })
}
