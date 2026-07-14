import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole, roleGte } from "@/lib/rbac"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = await getUserRole(supabase, user.id)
  if (!roleGte(role, "tenant_admin")) {
    return Response.json({ error: "Only tenant admins can override risk." }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    productId?: string
    riskScore?: number
    verificationStatus?: string
    reason?: string
  } | null

  if (!body?.productId || typeof body.riskScore !== "number") {
    return Response.json({ error: "productId and riskScore are required" }, { status: 400 })
  }

  const safeRisk = Math.max(0, Math.min(100, Math.round(body.riskScore)))
  const admin = createAdminClient()

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, organization_id, risk_score")
    .eq("id", body.productId)
    .maybeSingle()
  if (productError || !product) {
    return Response.json({ error: "Product not found" }, { status: 404 })
  }

  const ALLOWED_VERIFICATION_STATUSES = ["verified", "suspicious", "high_risk", "counterfeit_flagged"] as const
  type VerificationStatus = (typeof ALLOWED_VERIFICATION_STATUSES)[number]
  const defaultStatus: VerificationStatus = safeRisk >= 71 ? "high_risk" : safeRisk >= 31 ? "suspicious" : "verified"
  const requested = body.verificationStatus
  const status: VerificationStatus =
    requested && (ALLOWED_VERIFICATION_STATUSES as readonly string[]).includes(requested)
      ? (requested as VerificationStatus)
      : defaultStatus

  const { error } = await admin
    .from("products")
    .update({
      risk_score: safeRisk,
      verification_status: status,
    })
    .eq("id", body.productId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await admin.from("verification_events").insert({
    product_id: body.productId,
    organization_id: product.organization_id ?? null,
    event_type: "risk_override",
    event_message: body.reason?.trim() || "Manual risk override by tenant admin.",
    score_change: safeRisk - Number(product.risk_score ?? 0),
    risk_before: Number(product.risk_score ?? 0),
    risk_after: safeRisk,
    metadata_json: {
      actor_user_id: user.id,
      actor_role: role,
      manual_override: true,
    },
  })

  return Response.json({ success: true, riskScore: safeRisk, verificationStatus: status })
}
