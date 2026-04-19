"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getScopedPassportIds,
  getScopedProductIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"

export type DateRangePreset = "7d" | "30d" | "90d" | "custom"

export type AnalyticsFilters = {
  dateRange: DateRangePreset
  customStart?: string
  customEnd?: string
  productId?: string | null
  country?: string | null
}

export type KpiMetrics = {
  totalScans: number
  totalScansPrev: number
  uniqueProductsScanned: number
  uniqueProductsScannedPrev: number
  activePassports: number
  activePassportsPrev: number
  fraudAlerts: number
  fraudAlertsPrev: number
  ownershipClaims: number
  ownershipClaimsPrev: number
}

export type ScanOverTimePoint = { date: string; scans: number }
export type CountryCount = { country: string; count: number }
export type FraudDistribution = { status: string; count: number }
export type TopProduct = { productId: string; productName: string; scans: number }
export type OwnershipOverTimePoint = { date: string; claims: number }

export type FraudAlert = {
  id: string
  passportId: string
  serialNumber: string
  productName: string
  scanTimestamp: string
  riskScore: number
  scanResult: string
  locationCountry: string | null
  reason?: string
}

function getDateBounds(filters: AnalyticsFilters): { start: string; end: string } {
  const end = new Date()
  let start: Date
  switch (filters.dateRange) {
    case "7d":
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "90d":
      start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case "custom":
      start = filters.customStart ? new Date(filters.customStart) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function getPrevPeriodBounds(start: string, end: string): { start: string; end: string } {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const prevEnd = new Date(startDate.getTime() - 1)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  }
}

export async function getAnalyticsKpis(
  userId: string,
  filters: AnalyticsFilters
): Promise<KpiMetrics> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)
  const { start: prevStart, end: prevEnd } = getPrevPeriodBounds(start, end)

  const admin = createAdminClient()
  const productIds = await getScopedProductIds(userId)
  const productIdsForPassports = productIds.length ? productIds : [NIL_UUID]

  const [currentScansRes, prevScansRes, currentUniqueRes, prevUniqueRes, passportCountRes, fraudCurrent, fraudPrev, ownershipCurrent, ownershipPrev] =
    await Promise.all([
      admin
        .from("passport_scans")
        .select("id", { head: true, count: "exact" })
        .in("passport_id", ids)
        .gte("scan_timestamp", `${start}T00:00:00Z`)
        .lte("scan_timestamp", `${end}T23:59:59.999Z`),
      admin
        .from("passport_scans")
        .select("id", { head: true, count: "exact" })
        .in("passport_id", ids)
        .gte("scan_timestamp", `${prevStart}T00:00:00Z`)
        .lte("scan_timestamp", `${prevEnd}T23:59:59.999Z`),
      admin
        .from("passport_scans")
        .select("passport_id")
        .in("passport_id", ids)
        .gte("scan_timestamp", `${start}T00:00:00Z`)
        .lte("scan_timestamp", `${end}T23:59:59.999Z`),
      admin
        .from("passport_scans")
        .select("passport_id")
        .in("passport_id", ids)
        .gte("scan_timestamp", `${prevStart}T00:00:00Z`)
        .lte("scan_timestamp", `${prevEnd}T23:59:59.999Z`),
      admin
        .from("passports")
        .select("id", { head: true, count: "exact" })
        .in("product_id", productIdsForPassports)
        .eq("status", "active"),
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
        .from("ownership_records")
        .select("id", { head: true, count: "exact" })
        .in("passport_id", ids)
        .gte("claimed_at", `${start}T00:00:00Z`)
        .lte("claimed_at", `${end}T23:59:59.999Z`),
      admin
        .from("ownership_records")
        .select("id", { head: true, count: "exact" })
        .in("passport_id", ids)
        .gte("claimed_at", `${prevStart}T00:00:00Z`)
        .lte("claimed_at", `${prevEnd}T23:59:59.999Z`),
    ])

  const currentUnique = new Set((currentUniqueRes.data ?? []).map((x) => x.passport_id)).size
  const prevUnique = new Set((prevUniqueRes.data ?? []).map((x) => x.passport_id)).size

  return {
    totalScans: currentScansRes.count ?? 0,
    totalScansPrev: prevScansRes.count ?? 0,
    uniqueProductsScanned: currentUnique,
    uniqueProductsScannedPrev: prevUnique,
    activePassports: passportCountRes.count ?? 0,
    activePassportsPrev: passportCountRes.count ?? 0,
    fraudAlerts: fraudCurrent.count ?? 0,
    fraudAlertsPrev: fraudPrev.count ?? 0,
    ownershipClaims: ownershipCurrent.count ?? 0,
    ownershipClaimsPrev: ownershipPrev.count ?? 0,
  }
}

export async function getScansOverTime(
  userId: string,
  filters: AnalyticsFilters
): Promise<ScanOverTimePoint[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)

  const admin = createAdminClient()
  const { data: raw, error } = await admin
    .from("passport_scans")
    .select("scan_timestamp")
    .in("passport_id", ids)
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)

  if (error || !raw) return []

  const byDate: Record<string, number> = {}
  for (const row of raw) {
    const d = (row.scan_timestamp as string).slice(0, 10)
    byDate[d] = (byDate[d] ?? 0) + 1
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scans]) => ({ date, scans }))
}

export async function getTopCountries(
  userId: string,
  filters: AnalyticsFilters
): Promise<CountryCount[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passport_scans")
    .select("location_country")
    .in("passport_id", ids)
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)
    .not("location_country", "is", null)

  if (error || !data) return []

  const byCountry: Record<string, number> = {}
  for (const row of data) {
    const c = (row.location_country ?? "").trim() || "Unknown"
    byCountry[c] = (byCountry[c] ?? 0) + 1
  }
  return Object.entries(byCountry)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }))
}

export async function getFraudDistribution(
  userId: string,
  filters: AnalyticsFilters
): Promise<FraudDistribution[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passport_scans")
    .select("scan_result")
    .in("passport_id", ids)
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)

  if (error || !data) return []

  const byStatus: Record<string, number> = {}
  for (const row of data) {
    const s = row.scan_result ?? "valid"
    byStatus[s] = (byStatus[s] ?? 0) + 1
  }
  return Object.entries(byStatus).map(([status, count]) => ({ status, count }))
}

export async function getTopProducts(
  userId: string,
  filters: AnalyticsFilters
): Promise<TopProduct[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passport_scans")
    .select("passport_id, passports(product_id, products(name))")
    .in("passport_id", ids)
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)

  if (error || !data) return []

  const byProduct: Record<string, { name: string; count: number }> = {}
  for (const row of data as Array<Record<string, unknown>>) {
    const p = row.passports as { product_id?: string; products?: { name?: string } | null } | null
    const productId = p?.product_id ?? "unknown"
    const prod = Array.isArray(p?.products) ? p.products[0] : p?.products
    const name = prod?.name ?? "Unknown Product"
    if (!byProduct[productId]) byProduct[productId] = { name, count: 0 }
    byProduct[productId].count++
  }
  return Object.entries(byProduct)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([productId, { name, count }]) => ({ productId, productName: name, scans: count }))
}

export async function getOwnershipOverTime(
  userId: string,
  filters: AnalyticsFilters
): Promise<OwnershipOverTimePoint[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ownership_records")
    .select("claimed_at")
    .in("passport_id", ids)
    .gte("claimed_at", `${start}T00:00:00Z`)
    .lte("claimed_at", `${end}T23:59:59.999Z`)

  if (error || !data) return []

  const byDate: Record<string, number> = {}
  for (const row of data) {
    const d = (row.claimed_at as string).slice(0, 10)
    byDate[d] = (byDate[d] ?? 0) + 1
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, claims]) => ({ date, claims }))
}

export async function getFraudAlerts(
  userId: string,
  filters: AnalyticsFilters,
  limit = 20
): Promise<FraudAlert[]> {
  const passportIds = await getScopedPassportIds(userId)
  const ids = passportIds.length ? passportIds : [NIL_UUID]
  const { start, end } = getDateBounds(filters)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passport_scans")
    .select(`
      id, passport_id, scan_timestamp, scan_result, risk_score, location_country,
      passports(serial_number, products(name))
    `)
    .in("passport_id", ids)
    .eq("scan_result", "suspicious")
    .gte("scan_timestamp", `${start}T00:00:00Z`)
    .lte("scan_timestamp", `${end}T23:59:59.999Z`)
    .order("scan_timestamp", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as Array<Record<string, unknown>>).map((r) => {
    const p = r.passports as { serial_number?: string; products?: { name?: string } | null } | null
    const prod = Array.isArray(p?.products) ? p?.products?.[0] : p?.products
    return {
    id: String(r.id),
    passportId: String(r.passport_id),
    serialNumber: p?.serial_number ?? "—",
    productName: prod?.name ?? "—",
    scanTimestamp: String(r.scan_timestamp),
    riskScore: (r.risk_score as number) ?? 0,
    scanResult: String(r.scan_result),
    locationCountry: r.location_country as string | null,
    reason: (r.risk_score as number) != null && (r.risk_score as number) >= 70 ? "High-risk pattern" : "Suspicious activity",
  }
  })
}
