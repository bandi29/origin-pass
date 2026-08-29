import { createAdminClient } from "@/lib/supabase/admin"
import { clampRisk } from "@/lib/counterfeit-alerts-risk"
import type {
  CounterfeitAlertStatus,
  CounterfeitResolutionType,
  ResolutionAction,
} from "@/lib/counterfeit-alerts-types"
import {
  appendStatusHistory,
  writeAudit,
} from "@/lib/counterfeit-alerts-server"
import { schedulePassportStorefrontSync } from "@/lib/shopify-dpp-storefront-sync"
export async function loadProductRisk(productId: string): Promise<{
  risk_score: number
  verification_status: string
  qr_identity_id: string | null
  organization_id: string | null
} | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("products")
    .select("risk_score, verification_status, qr_identity_id, organization_id")
    .eq("id", productId)
    .maybeSingle()
  if (error || !data) return null
  return {
    risk_score: Number(data.risk_score ?? 0),
    verification_status: String(data.verification_status ?? "unverified"),
    qr_identity_id: data.qr_identity_id ? String(data.qr_identity_id) : null,
    organization_id: data.organization_id ? String(data.organization_id) : null,
  }
}

export async function applyInvestigationSideEffects(input: {
  actorId: string
  productId: string
  passportId: string | null
  qrIdentityId: string | null
  actions: ResolutionAction[]
  /** Extra risk delta after resolution type handling */
  riskDelta: number
  ip: string | null
}): Promise<{ risk_after: number; verification_status: string }> {
  const admin = createAdminClient()
  const prod = await loadProductRisk(input.productId)
  if (!prod) {
    throw new Error("product_not_found")
  }

  let risk = clampRisk(prod.risk_score + input.riskDelta)
  let verificationStatus = prod.verification_status

  const qrId = input.qrIdentityId ?? prod.qr_identity_id

  for (const action of input.actions) {
    switch (action) {
      case "lower_risk":
        risk = clampRisk(risk - 15)
        if (risk < 31) verificationStatus = "verified"
        else if (risk < 71) verificationStatus = "suspicious"
        break
      case "whitelist_product":
        risk = clampRisk(Math.min(risk, 15))
        verificationStatus = "verified"
        break
      case "blacklist_product":
        risk = clampRisk(Math.max(risk, 85))
        verificationStatus = "high_risk"
        await admin
          .from("products")
          .update({ lifecycle_status: "suspended" })
          .eq("id", input.productId)
        break
      case "suspend_qr":
        if (qrId) {
          await admin
            .from("qr_identities")
            .update({ activation_status: "compromised", updated_at: new Date().toISOString() })
            .eq("id", qrId)
        }
        verificationStatus = verificationStatus === "verified" ? "suspicious" : verificationStatus
        break
      case "revoke_passport":
        if (input.passportId) {
          await admin
            .from("passports")
            .update({ status: "revoked" })
            .eq("id", input.passportId)
          schedulePassportStorefrontSync(input.passportId)
        }
        break
      case "mark_false_positive":
        risk = clampRisk(risk - 15)
        break
      default:
        break
    }
  }

  await admin
    .from("products")
    .update({
      risk_score: risk,
      verification_status: verificationStatus,
    })
    .eq("id", input.productId)

  await admin.from("verification_events").insert({
    product_id: input.productId,
    organization_id: prod.organization_id,
    rule_id: null,
    event_type: "investigation_resolution",
    event_message: "Investigation actions applied to product risk and trust state.",
    score_change: risk - prod.risk_score,
    risk_before: prod.risk_score,
    risk_after: risk,
    metadata_json: {
      actor_user_id: input.actorId,
      actions: input.actions,
      ip: input.ip,
    },
  })

  return { risk_after: risk, verification_status: verificationStatus }
}

export async function finalizeAlertResolution(input: {
  alertId: string
  actorId: string
  fromStatus: CounterfeitAlertStatus
  targetStatus: CounterfeitAlertStatus
  resolutionType: CounterfeitResolutionType
  notes: string
  actions: ResolutionAction[]
  attachments: unknown
  ip: string | null
  productId: string
  passportId: string | null
  qrIdentityId: string | null
  riskAdjustment: number
}) {
  const admin = createAdminClient()
  const { risk_after, verification_status } = await applyInvestigationSideEffects({
    actorId: input.actorId,
    productId: input.productId,
    passportId: input.passportId,
    qrIdentityId: input.qrIdentityId,
    actions: input.actions,
    riskDelta: input.riskAdjustment,
    ip: input.ip,
  })

  await admin
    .from("counterfeit_alerts")
    .update({
      status: input.targetStatus,
      resolution_type: input.resolutionType,
      resolution_notes: input.notes.trim(),
      resolution_actions: input.actions,
      resolved_by: input.actorId,
      resolved_at: new Date().toISOString(),
      verification_confidence: Math.max(0, 100 - risk_after),
      archived_at: input.targetStatus === "archived" ? new Date().toISOString() : null,
    })
    .eq("id", input.alertId)

  await admin.from("alert_resolution_logs").insert({
    alert_id: input.alertId,
    resolution_type: input.resolutionType,
    notes: input.notes.trim(),
    actor_id: input.actorId,
    attachments: input.attachments ?? null,
    metadata: {
      target_status: input.targetStatus,
      risk_after,
      verification_status,
      ip: input.ip,
    },
  })

  await appendStatusHistory(
    input.alertId,
    input.fromStatus,
    input.targetStatus,
    input.actorId,
    input.notes.trim().slice(0, 500),
    { resolution_type: input.resolutionType, risk_after },
  )

  await writeAudit(input.actorId, "counterfeit_alert_resolved", input.alertId, {
    resolution_type: input.resolutionType,
    target_status: input.targetStatus,
    risk_after,
    verification_status,
    ip: input.ip,
  })
}
