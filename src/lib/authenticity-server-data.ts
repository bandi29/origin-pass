import { createAdminClient } from "@/lib/supabase/admin"
import {
  getScopedPassportIds,
  getScopedProductIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"
import type {
  AlertIssueType,
  AlertSeverity,
  AlertStatus,
  AuthenticityMetric,
  AuthenticityRow,
  CounterfeitAlert,
} from "@/lib/authenticity-dashboard-data"
import type {
  AlertTypeSlice,
  AnalyticsDayPoint,
  AuditLogEntry,
  FraudAnalyticsPayload,
  GeoHeatRow,
  ScanEvent,
  TopAffectedProduct,
} from "@/lib/authenticity-intelligence"
import { approxCoordsFromLocation } from "@/lib/geo-approx"

function boundsLastDays(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function prevPeriodSameLength(start: string, end: string): { start: string; end: string } {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T23:59:59.999Z`)
  const diffMs = endDate.getTime() - startDate.getTime()
  const prevEnd = new Date(startDate.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  }
}

function pctTrendLabel(current: number, previous: number): { label: string; trendUp: boolean } {
  if (previous === 0 && current === 0) {
    return { label: "No activity in this period", trendUp: true }
  }
  if (previous === 0) {
    return { label: "New vs prior period", trendUp: true }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  const trendUp = pct >= 0
  return {
    label: `${pct >= 0 ? "+" : ""}${pct}% vs prior period`,
    trendUp,
  }
}

function mapScanResultToStatus(
  r: string | null
): "verified" | "suspicious" | "failed" {
  switch (r) {
    case "suspicious":
      return "suspicious"
    case "duplicate":
    case "invalid":
      return "failed"
    default:
      return "verified"
  }
}

function severityFromRisk(score: number | null): AlertSeverity {
  const s = score ?? 0
  if (s >= 70) return "high"
  if (s >= 35) return "medium"
  return "low"
}

function issueTypeFromScanResult(r: string | null): AlertIssueType {
  switch (r) {
    case "duplicate":
      return "duplicate"
    case "invalid":
      return "invalid_qr"
    default:
      return "location_mismatch"
  }
}

function scanToEvent(
  scan: {
    id: string
    location_country: string | null
    location_city: string | null
    scan_timestamp: string
  },
  productId: string
): ScanEvent {
  const { lat, long } = approxCoordsFromLocation(
    scan.location_country,
    scan.location_city
  )
  const region = (scan.location_country ?? "").trim().slice(0, 6) || undefined
  return {
    scan_id: scan.id,
    product_id: productId,
    lat,
    long,
    timestamp: scan.scan_timestamp,
    region_code: region,
  }
}

export type AuthenticityOverviewPayload = {
  metrics: AuthenticityMetric[]
  rows: AuthenticityRow[]
  scansByProductId: Record<string, ScanEvent[]>
}

export async function getAuthenticityOverviewData(
  userId: string
): Promise<AuthenticityOverviewPayload> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const productIds = await getScopedProductIds(userId)
  const productScope = productIds.length ? productIds : [NIL_UUID]

  const admin = createAdminClient()
  const { start, end } = boundsLastDays(30)
  const { start: prevStart, end: prevEnd } = prevPeriodSameLength(start, end)

  const [
    passportCountRes,
    newPassportsCurrentRes,
    newPassportsPrevRes,
    validRes,
    validPrevRes,
    failedRes,
    failedPrevRes,
    alertRes,
    alertPrevRes,
    recentScansRes,
    productScansRes,
  ] = await Promise.all([
    admin
      .from("passports")
      .select("id", { head: true, count: "exact" })
      .in("product_id", productScope)
      .eq("status", "active"),
    admin
      .from("passports")
      .select("id", { head: true, count: "exact" })
      .in("product_id", productScope)
      .gte("created_at", `${start}T00:00:00Z`)
      .lte("created_at", `${end}T23:59:59.999Z`),
    admin
      .from("passports")
      .select("id", { head: true, count: "exact" })
      .in("product_id", productScope)
      .gte("created_at", `${prevStart}T00:00:00Z`)
      .lte("created_at", `${prevEnd}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select("id", { head: true, count: "exact" })
      .in("passport_id", ids)
      .eq("scan_result", "valid")
      .gte("scan_timestamp", `${start}T00:00:00Z`)
      .lte("scan_timestamp", `${end}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select("id", { head: true, count: "exact" })
      .in("passport_id", ids)
      .eq("scan_result", "valid")
      .gte("scan_timestamp", `${prevStart}T00:00:00Z`)
      .lte("scan_timestamp", `${prevEnd}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select("id", { head: true, count: "exact" })
      .in("passport_id", ids)
      .in("scan_result", ["duplicate", "invalid"])
      .gte("scan_timestamp", `${start}T00:00:00Z`)
      .lte("scan_timestamp", `${end}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select("id", { head: true, count: "exact" })
      .in("passport_id", ids)
      .in("scan_result", ["duplicate", "invalid"])
      .gte("scan_timestamp", `${prevStart}T00:00:00Z`)
      .lte("scan_timestamp", `${prevEnd}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select("id", { head: true, count: "exact" })
      .in("passport_id", ids)
      .eq("scan_result", "suspicious")
      .gte("scan_timestamp", `${start}T00:00:00Z`)
      .lte("scan_timestamp", `${end}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select("id", { head: true, count: "exact" })
      .in("passport_id", ids)
      .eq("scan_result", "suspicious")
      .gte("scan_timestamp", `${prevStart}T00:00:00Z`)
      .lte("scan_timestamp", `${prevEnd}T23:59:59.999Z`),
    admin
      .from("passport_scans")
      .select(
        `
        id,
        scan_timestamp,
        scan_result,
        risk_score,
        location_country,
        location_city,
        passports!inner(
          id,
          serial_number,
          product_id,
          products(
            id,
            name,
            origin,
            batch_number
          )
        )
      `
      )
      .in("passport_id", ids)
      .order("scan_timestamp", { ascending: false })
      .limit(120),
    admin
      .from("passport_scans")
      .select(
        "id, location_country, location_city, scan_timestamp, passports!inner(product_id)"
      )
      .in("passport_id", ids)
      .gte("scan_timestamp", `${start}T00:00:00Z`)
      .lte("scan_timestamp", `${end}T23:59:59.999Z`)
      .order("scan_timestamp", { ascending: false })
      .limit(2000),
  ])

  const verifiedProducts = passportCountRes.count ?? 0
  const newPassportsCur = newPassportsCurrentRes.count ?? 0
  const newPassportsPrev = newPassportsPrevRes.count ?? 0
  const successful = validRes.count ?? 0
  const successfulPrev = validPrevRes.count ?? 0
  const failed = failedRes.count ?? 0
  const failedPrev = failedPrevRes.count ?? 0
  const alerts = alertRes.count ?? 0
  const alertsPrev = alertPrevRes.count ?? 0

  const m1 = pctTrendLabel(newPassportsCur, newPassportsPrev)
  const m2 = pctTrendLabel(successful, successfulPrev)
  const m3 = pctTrendLabel(failed, failedPrev)
  const m4 = pctTrendLabel(alerts, alertsPrev)

  const metrics: AuthenticityMetric[] = [
    {
      id: "verified_products",
      label: "Active passports",
      value: verifiedProducts.toLocaleString(),
      trendLabel:
        newPassportsCur === 0 && newPassportsPrev === 0
          ? "No new passports in the last 60 days"
          : `New passports (30d): ${m1.label}`,
      trendUp: m1.trendUp,
    },
    {
      id: "successful_scans",
      label: "Successful scans (30d)",
      value: successful.toLocaleString(),
      trendLabel: m2.label,
      trendUp: m2.trendUp,
    },
    {
      id: "failed_verifications",
      label: "Failed verifications (30d)",
      value: failed.toLocaleString(),
      trendLabel: m3.label,
      trendUp: !m3.trendUp,
    },
    {
      id: "active_alerts",
      label: "Suspicious scans (30d)",
      value: alerts.toLocaleString(),
      trendLabel: m4.label,
      trendUp: !m4.trendUp,
    },
  ]

  type RecentScan = {
    id: string
    scan_timestamp: string
    scan_result: string | null
    risk_score: number | null
    location_country: string | null
    location_city: string | null
    passports:
      | {
          id: string
          serial_number: string
          product_id: string
          products:
            | {
                id: string
                name: string | null
                origin: string | null
                batch_number: string | null
              }
            | {
                id: string
                name: string | null
                origin: string | null
                batch_number: string | null
              }[]
            | null
        }
      | {
          id: string
          serial_number: string
          product_id: string
          products:
            | {
                id: string
                name: string | null
                origin: string | null
                batch_number: string | null
              }
            | {
                id: string
                name: string | null
                origin: string | null
                batch_number: string | null
              }[]
            | null
        }[]
      | null
  }

  const rawRows = (recentScansRes.data ?? []) as RecentScan[]
  const seenProduct = new Set<string>()
  const rows: AuthenticityRow[] = []
  for (const s of rawRows) {
    const passport = Array.isArray(s.passports) ? s.passports[0] : s.passports
    const rawProd = passport?.products
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd
    const pid = prod?.id ?? passport?.product_id
    if (!pid || seenProduct.has(pid)) continue
    seenProduct.add(pid)
    const city = (s.location_city ?? "").trim()
    const country = (s.location_country ?? "").trim()
    const loc =
      city && country
        ? `${city}, ${country}`
        : country || city || "—"
    const serial = passport?.serial_number ?? "—"
    rows.push({
      product_id: pid,
      product_name: prod?.name ?? "Unknown product",
      batch_id: prod?.batch_number?.trim() || "—",
      qr_id: serial.length > 18 ? `QR-${serial.slice(-14)}` : `QR-${serial}`,
      last_scan_location: loc,
      status: mapScanResultToStatus(s.scan_result),
      timestamp: s.scan_timestamp,
      origin: prod?.origin?.trim() || "—",
    })
    if (rows.length >= 24) break
  }

  const scansByProductId: Record<string, ScanEvent[]> = {}
  const productScanRows = (productScansRes.data ?? []) as Array<{
    id: string
    location_country: string | null
    location_city: string | null
    scan_timestamp: string
    passports: { product_id: string } | { product_id: string }[] | null
  }>
  for (const sc of productScanRows) {
    const p = sc.passports
    const passport = Array.isArray(p) ? p[0] : p
    const pid = passport?.product_id
    if (!pid) continue
    if (!scansByProductId[pid]) scansByProductId[pid] = []
    scansByProductId[pid]!.push(scanToEvent(sc, pid))
  }

  return { metrics, rows, scansByProductId }
}

export async function getCounterfeitAlertsForUser(
  userId: string,
  limit = 50
): Promise<CounterfeitAlert[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const admin = createAdminClient()
  const { start, end } = boundsLastDays(90)

  const { data: suspicious, error } = await admin
    .from("passport_scans")
    .select(
      `
      id,
      scan_timestamp,
      scan_result,
      risk_score,
      location_country,
      location_city,
      passport_id,
      passports!inner(
        id,
        serial_number,
        product_id,
        products(id, name)
      )
    `
    )
    .in("passport_id", ids)
    .neq("scan_result", "valid")
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)
    .order("scan_timestamp", { ascending: false })
    .limit(limit)

  if (error || !suspicious?.length) return []

  type Row = {
    id: string
    scan_timestamp: string
    scan_result: string | null
    risk_score: number | null
    location_country: string | null
    location_city: string | null
    passport_id: string
    passports:
      | {
          id: string
          serial_number: string
          product_id: string
          products:
            | { id: string; name: string | null }
            | { id: string; name: string | null }[]
            | null
        }
      | {
          id: string
          serial_number: string
          product_id: string
          products:
            | { id: string; name: string | null }
            | { id: string; name: string | null }[]
            | null
        }[]
      | null
  }

  const historyPromises = (suspicious as Row[]).map((r) =>
    admin
      .from("passport_scans")
      .select(
        "scan_timestamp, scan_result, location_city, location_country, risk_score"
      )
      .eq("passport_id", r.passport_id)
      .order("scan_timestamp", { ascending: false })
      .limit(6)
  )
  const historyResults = await Promise.all(historyPromises)

  const out: CounterfeitAlert[] = []
  ;(suspicious as Row[]).forEach((r, idx) => {
    const passport = Array.isArray(r.passports) ? r.passports[0] : r.passports
    const rawProd = passport?.products
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd
    const productId = prod?.id ?? passport?.product_id ?? "—"
    const city = (r.location_city ?? "").trim()
    const country = (r.location_country ?? "").trim()
    const location =
      city && country ? `${city}, ${country}` : country || city || "—"

    const histRes = historyResults[idx]
    const histRows = histRes?.data ?? []
    const scan_history = histRows.map((h) => {
      const hc = (h.location_city ?? "").trim()
      const hk = (h.location_country ?? "").trim()
      const loc =
        hc && hk ? `${hc}, ${hk}` : hk || hc || undefined
      return {
        at: h.scan_timestamp as string,
        event:
          h.scan_result === "suspicious"
            ? "Suspicious scan"
            : h.scan_result === "duplicate"
              ? "Duplicate pattern"
              : h.scan_result === "invalid"
                ? "Invalid verification"
                : "Scan",
        location: loc,
      }
    })

    const status: AlertStatus =
      (r.scan_result === "suspicious" ? "investigating" : "open") as AlertStatus

    out.push({
      alert_id: `ALT-${String(r.id).replace(/-/g, "").slice(0, 10)}`,
      product_id: productId,
      product_name: prod?.name ?? "Unknown product",
      issue_type: issueTypeFromScanResult(r.scan_result),
      severity: severityFromRisk(r.risk_score),
      location,
      timestamp: r.scan_timestamp,
      status,
      scan_history:
        scan_history.length > 0
          ? scan_history
          : [
              {
                at: r.scan_timestamp,
                event: "Recorded",
                location,
              },
            ],
      timeline: [
        {
          at: r.scan_timestamp,
          label:
            r.scan_result === "suspicious"
              ? "Suspicious scan recorded"
              : "Verification anomaly recorded",
        },
      ],
    })
  })

  return out
}

export async function getFraudAnalyticsData(
  userId: string
): Promise<FraudAnalyticsPayload> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = boundsLastDays(30)
  const admin = createAdminClient()

  const { data: scans, error } = await admin
    .from("passport_scans")
    .select(
      `
      scan_timestamp,
      scan_result,
      risk_score,
      passports!inner(product_id, products(id, name))
    `
    )
    .in("passport_id", ids)
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)

  if (error || !scans?.length) {
    return {
      timeSeries: [],
      topAffected: [],
      alertMix: [],
      kpis: { totalAlerts30d: 0, highRiskProducts: 0, suspiciousSharePct: 0 },
    }
  }

  const suspiciousByDate: Record<string, number> = {}
  const problemByResult: Record<string, number> = {
    duplicate: 0,
    invalid: 0,
    suspicious: 0,
  }
  const productProblemCount: Record<string, { name: string; count: number }> = {}
  const productHighRisk = new Set<string>()
  let total = 0
  let suspiciousOnly = 0

  for (const row of scans as Array<Record<string, unknown>>) {
    total++
    const ts = row.scan_timestamp as string
    const day = ts.slice(0, 10)
    const sr = (row.scan_result as string) ?? "valid"
    const rawPass = row.passports as
      | {
          product_id?: string
          products?:
            | { id?: string; name?: string | null }
            | { id?: string; name?: string | null }[]
            | null
        }
      | {
          product_id?: string
          products?:
            | { id?: string; name?: string | null }
            | { id?: string; name?: string | null }[]
            | null
        }[]
      | null
    const p = Array.isArray(rawPass) ? rawPass[0] : rawPass
    const rawProd = p?.products
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd
    if (sr === "suspicious") {
      suspiciousOnly++
      suspiciousByDate[day] = (suspiciousByDate[day] ?? 0) + 1
    }
    if (sr !== "valid") {
      problemByResult[sr] = (problemByResult[sr] ?? 0) + 1
      const name = prod?.name ?? "Unknown"
      const pid = prod?.id ?? p?.product_id ?? "unknown"
      if (!productProblemCount[pid]) {
        productProblemCount[pid] = { name, count: 0 }
      }
      productProblemCount[pid]!.count++
    }
    const rs = row.risk_score as number | null
    if (rs != null && rs >= 70) {
      const pid = prod?.id ?? p?.product_id
      if (pid) productHighRisk.add(pid)
    }
  }

  const timeSeries: AnalyticsDayPoint[] = Object.entries(suspiciousByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, suspicious_count]) => ({ date, suspicious_count }))

  const topAffected: TopAffectedProduct[] = Object.entries(productProblemCount)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 8)
    .map(([product_id, { name, count }]) => ({
      product_id,
      product_name: name,
      alert_count: count,
    }))

  const fills: Record<string, string> = {
    duplicate: "#0f172a",
    suspicious: "#f59e0b",
    invalid: "#dc2626",
  }
  const alertMix: AlertTypeSlice[] = (["duplicate", "suspicious", "invalid"] as const)
    .map((k) => ({
      name: k === "invalid" ? "Invalid QR" : k === "duplicate" ? "Duplicate" : "Suspicious",
      value: problemByResult[k] ?? 0,
      fill: fills[k] ?? "#64748b",
    }))
    .filter((x) => x.value > 0)

  const problemTotal =
    (problemByResult.duplicate ?? 0) +
    (problemByResult.invalid ?? 0) +
    (problemByResult.suspicious ?? 0)

  return {
    timeSeries,
    topAffected,
    alertMix,
    kpis: {
      totalAlerts30d: problemTotal,
      highRiskProducts: productHighRisk.size,
      suspiciousSharePct: total > 0 ? Math.round((suspiciousOnly / total) * 100) : 0,
    },
  }
}

export async function getGeoHeatForUser(userId: string): Promise<GeoHeatRow[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = boundsLastDays(30)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("passport_scans")
    .select(
      "location_country, location_city, passport_id, passports!inner(product_id)"
    )
    .in("passport_id", ids)
    .eq("scan_result", "suspicious")
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)
    .not("location_country", "is", null)

  if (error || !data?.length) return []

  type G = {
    location_country: string | null
    location_city: string | null
    passport_id: string
    passports: { product_id: string } | { product_id: string }[] | null
  }

  const groups: Record<
    string,
    { country: string; city: string; scans: number; products: Set<string> }
  > = {}

  for (const row of data as G[]) {
    const country = (row.location_country ?? "Unknown").trim() || "Unknown"
    const city = (row.location_city ?? "—").trim() || "—"
    const key = `${country}|${city}`
    if (!groups[key]) {
      groups[key] = {
        country,
        city,
        scans: 0,
        products: new Set(),
      }
    }
    groups[key]!.scans++
    const p = row.passports
    const passport = Array.isArray(p) ? p[0] : p
    const productId = passport?.product_id
    if (productId) groups[key]!.products.add(productId)
  }

  const rows: GeoHeatRow[] = Object.values(groups).map((g) => {
    const { lat, long } = approxCoordsFromLocation(g.country, g.city)
    const n = g.scans
    const intensity: GeoHeatRow["intensity"] =
      n >= 20 ? "high" : n >= 8 ? "moderate" : "low"
    return {
      country: g.country,
      city: g.city,
      lat,
      long,
      suspicious_scans: n,
      affected_products: g.products.size,
      intensity,
    }
  })

  return rows.sort((a, b) => b.suspicious_scans - a.suspicious_scans)
}

export async function getAuditLogForUser(
  userId: string,
  limit = 200
): Promise<AuditLogEntry[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("passport_scans")
    .select(
      `
      id,
      scan_timestamp,
      scan_result,
      location_country,
      location_city,
      passports!inner(
        product_id,
        products(id, name)
      )
    `
    )
    .in("passport_id", ids)
    .order("scan_timestamp", { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  type R = {
    id: string
    scan_timestamp: string
    scan_result: string | null
    location_country: string | null
    location_city: string | null
    passports:
      | {
          product_id: string
          products:
            | { id: string; name: string | null }
            | { id: string; name: string | null }[]
            | null
        }
      | {
          product_id: string
          products:
            | { id: string; name: string | null }
            | { id: string; name: string | null }[]
            | null
        }[]
      | null
  }

  return (data as R[]).map((r) => {
    const passport = Array.isArray(r.passports) ? r.passports[0] : r.passports
    const rawProd = passport?.products
    const prod = Array.isArray(rawProd) ? rawProd[0] : rawProd
    const pid = prod?.id ?? passport?.product_id ?? "—"
    const city = (r.location_city ?? "").trim()
    const country = (r.location_country ?? "").trim()
    const location =
      city && country ? `${city}, ${country}` : country || city || "—"
    const sr = r.scan_result ?? "valid"
    const action: AuditLogEntry["action"] =
      sr === "suspicious" ? "Flagged" : sr === "valid" ? "Scan" : "Verify"
    const result: AuditLogEntry["result"] =
      sr === "invalid" ? "Failed" : "Success"
    return {
      event_id: `AUD-${String(r.id).replace(/-/g, "").slice(0, 12)}`,
      product_id: pid,
      action,
      result,
      location,
      timestamp: r.scan_timestamp,
      actor: "customer:scan",
    }
  })
}
