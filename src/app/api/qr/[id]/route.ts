import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProductInScope } from "@/backend/modules/organizations/scope"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: qr } = await admin
    .from("qr_identities")
    .select("id, product_id, qr_code, qr_url, activation_status, total_scans, first_scan_at, last_scan_at, issued_at")
    .eq("id", id)
    .maybeSingle()
  if (!qr) return Response.json({ error: "QR identity not found" }, { status: 404 })

  if (!(await isProductInScope(user.id, qr.product_id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const [product, scans, anomalies, ownership] = await Promise.all([
    admin.from("products").select("id, name, sku, risk_score, verification_status").eq("id", qr.product_id).maybeSingle(),
    admin
      .from("scan_events")
      .select("scanned_at, geo_country, geo_city, scan_source, metadata_json")
      .eq("qr_identity_id", qr.id)
      .order("scanned_at", { ascending: false })
      .limit(12),
    admin
      .from("qr_anomaly_events")
      .select("anomaly_type, severity, score, occurred_at, metadata")
      .eq("qr_identity_id", qr.id)
      .order("occurred_at", { ascending: false })
      .limit(8),
    admin
      .from("ownership_chain")
      .select("owner_type, owner_name, transferred_at")
      .eq("product_id", qr.product_id)
      .order("transferred_at", { ascending: false })
      .limit(8),
  ])

  return Response.json({
    qr,
    product: product.data ?? null,
    scans: scans.data ?? [],
    anomalies: anomalies.data ?? [],
    ownership: ownership.data ?? [],
  })
}
