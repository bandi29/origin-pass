import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProductInScope } from "@/backend/modules/organizations/scope"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { qrIdentityId?: string; reason?: string } | null
  if (!body?.qrIdentityId) return Response.json({ error: "qrIdentityId is required" }, { status: 400 })

  const admin = createAdminClient()
  const { data: qr } = await admin
    .from("qr_identities")
    .select("id, product_id, organization_id, activation_status")
    .eq("id", body.qrIdentityId)
    .maybeSingle()
  if (!qr) return Response.json({ error: "QR identity not found" }, { status: 404 })

  if (!(await isProductInScope(user.id, qr.product_id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  await admin
    .from("qr_identities")
    .update({ activation_status: "active", updated_at: new Date().toISOString() })
    .eq("id", qr.id)
  await admin.from("qr_activation_logs").insert({
    qr_identity_id: qr.id,
    product_id: qr.product_id,
    organization_id: qr.organization_id,
    actor_user_id: user.id,
    previous_status: qr.activation_status,
    next_status: "active",
    reason: body.reason?.trim() || "Manual activation",
  })

  return Response.json({ success: true })
}
