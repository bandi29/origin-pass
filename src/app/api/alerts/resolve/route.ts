import { createClient } from "@/lib/supabase/server"
import { getUserRole, canResolveCounterfeitAlerts } from "@/lib/rbac"
import { assertAlertScoped } from "@/lib/counterfeit-alerts-server"
import { finalizeAlertResolution } from "@/lib/counterfeit-alerts-mutations"
import { getRequestIp } from "@/lib/alerts-api-helpers"
import type {
  CounterfeitAlertStatus,
  CounterfeitResolutionType,
  ResolutionAction,
} from "@/lib/counterfeit-alerts-types"

function riskAdjustmentForResolution(type: CounterfeitResolutionType): number {
  switch (type) {
    case "counterfeit_confirmed":
      return 60
    case "legitimate_activity":
    case "customer_travel":
    case "logistics_explanation":
    case "testing_activity":
    case "duplicate_packaging_issue":
    case "supplier_verification_completed":
      return -15
    default:
      return 0
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = await getUserRole(supabase, user.id)
  if (!canResolveCounterfeitAlerts(role)) {
    return Response.json({ error: "Only authorized investigators can resolve alerts." }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    alertId?: string
    resolutionType?: CounterfeitResolutionType
    notes?: string
    actions?: ResolutionAction[]
    targetStatus?: CounterfeitAlertStatus
    attachments?: unknown
  } | null

  if (!body?.alertId || !body.resolutionType) {
    return Response.json({ error: "alertId and resolutionType required" }, { status: 400 })
  }

  const notes = (body.notes ?? "").trim()
  if (notes.length < 4) {
    return Response.json({ error: "Resolution notes are required (min 4 characters)." }, { status: 400 })
  }

  const scoped = await assertAlertScoped(user.id, body.alertId)
  if (!scoped) return Response.json({ error: "Not found" }, { status: 404 })

  if (scoped.status === "archived" || scoped.status === "resolved") {
    return Response.json({ error: "Alert is already closed." }, { status: 400 })
  }

  const ip = getRequestIp(request)
  const actions = Array.isArray(body.actions) ? body.actions : []

  let targetStatus: CounterfeitAlertStatus = body.targetStatus ?? "resolved"
  if (actions.includes("mark_false_positive")) {
    targetStatus = "false_positive"
  }
  if (body.resolutionType === "counterfeit_confirmed") {
    targetStatus = body.targetStatus ?? "resolved"
  }

  const riskAdjustment = riskAdjustmentForResolution(body.resolutionType)

  try {
    await finalizeAlertResolution({
      alertId: body.alertId,
      actorId: user.id,
      fromStatus: scoped.status,
      targetStatus,
      resolutionType: body.resolutionType,
      notes,
      actions,
      attachments: body.attachments ?? null,
      ip,
      productId: scoped.product_id,
      passportId: scoped.passport_id,
      qrIdentityId: scoped.qr_identity_id,
      riskAdjustment,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolution_failed"
    return Response.json({ error: msg }, { status: 500 })
  }

  return Response.json({ success: true })
}
