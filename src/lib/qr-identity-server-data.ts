import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"

export type QrMetric = {
  id: string
  label: string
  value: string
  trend: string
  status: "healthy" | "warning" | "critical"
  sparkline: number[]
}

export type QrTableRow = {
  id: string
  qrCode: string
  productId: string
  productName: string
  sku: string | null
  passportStatus: string
  activationStatus: string
  scanCount: number
  lastScanAt: string | null
  riskScore: number
  ownershipState: string
  geoStatus: string
  verifyUrl: string
}

export type QrRecentPassportRow = {
  passportId: string
  productId: string
  productName: string
  sku: string | null
  category: string | null
  imageUrl: string | null
  status: string
  createdAt: string
}

export type QrDashboardPayload = {
  metrics: QrMetric[]
  rows: QrTableRow[]
  recentPassports: QrRecentPassportRow[]
  recentActivity: Array<{ id: string; label: string; at: string; severity: "low" | "medium" | "high" }>
  scanSeries: Array<{ date: string; scans: number; suspicious: number }>
}

function fmt(n: number) {
  return n.toLocaleString()
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export async function getQrDashboardPayload(userId: string): Promise<QrDashboardPayload> {
  const admin = createAdminClient()
  const productIds = await getScopedProductIds(userId)
  const scoped = productIds.length ? productIds : ["00000000-0000-0000-0000-000000000000"]

  const [qrRes, scanRes, secRes, passRes, ownRes] = await Promise.all([
    admin
      .from("qr_identities")
      .select("id, product_id, qr_code, qr_url, activation_status, total_scans, last_scan_at")
      .in("product_id", scoped)
      .order("issued_at", { ascending: false })
      .limit(150),
    admin
      .from("scan_events")
      .select("product_id, scanned_at, metadata_json")
      .in("product_id", scoped)
      .order("scanned_at", { ascending: false })
      .limit(1200),
    admin
      .from("qr_security_events")
      .select("id, product_id, event_type, severity, detected_at")
      .in("product_id", scoped)
      .order("detected_at", { ascending: false })
      .limit(80),
    admin
      .from("passports")
      .select("product_id, status")
      .in("product_id", scoped),
    admin
      .from("ownership_chain")
      .select("product_id, owner_type, transferred_at")
      .in("product_id", scoped)
      .order("transferred_at", { ascending: false }),
  ])

  const productsRes = await admin
    .from("products")
    .select("id, name, sku, risk_score, verification_status")
    .in("id", scoped)

  const products = new Map(
    ((productsRes.data ?? []) as Array<{ id: string; name: string; sku: string | null; risk_score: number | null; verification_status: string | null }>).map((p) => [p.id, p]),
  )
  const passportByProduct = new Map<string, string>()
  for (const p of (passRes.data ?? []) as Array<{ product_id: string; status: string }>) {
    if (!passportByProduct.has(p.product_id)) passportByProduct.set(p.product_id, p.status)
  }
  const ownershipByProduct = new Map<string, string>()
  for (const o of (ownRes.data ?? []) as Array<{ product_id: string; owner_type: string }>) {
    if (!ownershipByProduct.has(o.product_id)) ownershipByProduct.set(o.product_id, o.owner_type)
  }

  const scans = (scanRes.data ?? []) as Array<{ product_id: string; scanned_at: string; metadata_json: { suspicious?: boolean } | null }>
  const byDay = new Map<string, { scans: number; suspicious: number }>()
  for (const s of scans) {
    const k = dayKey(s.scanned_at)
    const prev = byDay.get(k) ?? { scans: 0, suspicious: 0 }
    prev.scans += 1
    if (s.metadata_json?.suspicious) prev.suspicious += 1
    byDay.set(k, prev)
  }

  const rows: QrTableRow[] = ((qrRes.data ?? []) as Array<{
    id: string
    product_id: string
    qr_code: string
    qr_url: string
    activation_status: string
    total_scans: number
    last_scan_at: string | null
  }>).map((qr) => {
    const product = products.get(qr.product_id)
    return {
      id: qr.id,
      qrCode: qr.qr_code,
      productId: qr.product_id,
      productName: product?.name ?? "Unknown product",
      sku: product?.sku ?? null,
      passportStatus: passportByProduct.get(qr.product_id) ?? "unknown",
      activationStatus: qr.activation_status,
      scanCount: qr.total_scans ?? 0,
      lastScanAt: qr.last_scan_at,
      riskScore: Number(product?.risk_score ?? 0),
      ownershipState: ownershipByProduct.get(qr.product_id) ?? "unassigned",
      geoStatus: Number(product?.risk_score ?? 0) >= 71 ? "high-risk" : Number(product?.risk_score ?? 0) >= 31 ? "watch" : "stable",
      verifyUrl: qr.qr_url,
    }
  })

  const totalActive = rows.filter((r) => r.activationStatus === "active").length
  const pending = rows.filter((r) => r.activationStatus === "pending").length
  const compromised = rows.filter((r) => r.activationStatus === "compromised").length
  const today = new Date().toISOString().slice(0, 10)
  const scansToday = scans.filter((s) => s.scanned_at.startsWith(today)).length
  const avgRisk = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.riskScore, 0) / rows.length)
    : 0
  const verificationSuccessRate = rows.length
    ? Math.round((rows.filter((r) => r.riskScore <= 30).length / rows.length) * 100)
    : 0

  const sortedDayKeys = Array.from(byDay.keys()).sort().slice(-14)
  const sparklineScans = sortedDayKeys.map((k) => byDay.get(k)?.scans ?? 0)

  const metrics: QrMetric[] = [
    {
      id: "active",
      label: "Active QR Codes",
      value: fmt(totalActive),
      trend: `${rows.length ? Math.round((totalActive / rows.length) * 100) : 0}% of generated`,
      status: compromised > 0 ? "warning" : "healthy",
      sparkline: sparklineScans,
    },
    {
      id: "today",
      label: "Scans Today",
      value: fmt(scansToday),
      trend: "Real-time scan traffic",
      status: "healthy",
      sparkline: sparklineScans,
    },
    {
      id: "compromised",
      label: "Compromised QR Codes",
      value: fmt(compromised),
      trend: compromised > 0 ? "Investigate now" : "No active compromises",
      status: compromised > 0 ? "critical" : "healthy",
      sparkline: sparklineScans,
    },
    {
      id: "pending",
      label: "Pending Activation",
      value: fmt(pending),
      trend: "Awaiting activation workflow",
      status: pending > 0 ? "warning" : "healthy",
      sparkline: sparklineScans,
    },
    {
      id: "successRate",
      label: "Verification Success Rate",
      value: `${verificationSuccessRate}%`,
      trend: "Risk ≤ 30 considered verified",
      status: verificationSuccessRate >= 80 ? "healthy" : verificationSuccessRate >= 60 ? "warning" : "critical",
      sparkline: sparklineScans,
    },
    {
      id: "avgRisk",
      label: "Avg Scan Risk Score",
      value: String(avgRisk),
      trend: "0-30 safe · 31-70 suspicious · 71+ high risk",
      status: avgRisk >= 71 ? "critical" : avgRisk >= 31 ? "warning" : "healthy",
      sparkline: sparklineScans,
    },
  ]

  const recentActivity = ((secRes.data ?? []) as Array<{
    id: string
    event_type: string
    severity: "low" | "medium" | "high"
    detected_at: string
  }>).map((e) => ({
    id: e.id,
    label: e.event_type.replace(/_/g, " "),
    at: e.detected_at,
    severity: e.severity,
  }))

  const scanSeries = sortedDayKeys.map((k) => ({
    date: k,
    scans: byDay.get(k)?.scans ?? 0,
    suspicious: byDay.get(k)?.suspicious ?? 0,
  }))

  let recentPassports: QrRecentPassportRow[] = []
  if (productIds.length > 0) {
    const rpRes = await admin
      .from("passports")
      .select(
        "id, product_id, status, created_at, products ( name, sku, category, image_url )",
      )
      .in("product_id", productIds)
      .order("created_at", { ascending: false })
      .limit(8)

    type RpRow = {
      id: string
      product_id: string
      status: string
      created_at: string
      products:
        | { name: string; sku: string | null; category: string | null; image_url: string | null }
        | { name: string; sku: string | null; category: string | null; image_url: string | null }[]
        | null
    }

    for (const row of (rpRes.data ?? []) as RpRow[]) {
      const p = Array.isArray(row.products) ? row.products[0] : row.products
      recentPassports.push({
        passportId: row.id,
        productId: row.product_id,
        productName: p?.name ?? "Unknown product",
        sku: p?.sku ?? null,
        category: p?.category ?? null,
        imageUrl: p?.image_url ?? null,
        status: row.status,
        createdAt: row.created_at,
      })
    }
  }

  return { metrics, rows, recentPassports, recentActivity, scanSeries }
}
