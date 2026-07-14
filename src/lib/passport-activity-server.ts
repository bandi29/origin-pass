"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  getScopedOrgId,
  getScopedPassportIds,
  getScopedProductIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"
import { mapPassportActivityUpdateAuditRow } from "@/lib/passport-activity-audit"
import { PASSPORT_ACTIVITY_UPDATE_AUDIT_ACTIONS } from "@/lib/passport-activity-types"
import type {
  PassportActivityLogEntry,
  PassportActivitySummary,
} from "@/lib/passport-activity-types"

function scansTrendLabel(current: number, previous: number): string | null {
  if (current === 0 && previous === 0) return null
  if (previous === 0) return "New activity this week"
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return "Flat vs last week"
  return `${pct >= 0 ? "+" : ""}${pct}% vs last week`
}

function locationPhrase(city: string | null, country: string | null): string {
  const parts = [city?.trim(), country?.trim()].filter(Boolean)
  return parts.length ? parts.join(", ") : "unknown location"
}

async function fetchOrgMemberIds(userId: string): Promise<string[]> {
  const orgId = await getScopedOrgId(userId)
  if (!orgId) return [userId]

  const admin = createAdminClient()
  const { data } = await admin.from("users").select("id").eq("organization_id", orgId)
  const ids = (data ?? []).map((row) => row.id as string)
  return ids.length ? ids : [userId]
}

async function fetchPassportUpdateAuditRows(
  userId: string,
  scopedProductIds: Set<string>,
  limit: number,
): Promise<PassportActivityLogEntry[]> {
  const memberIds = await fetchOrgMemberIds(userId)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("audit_logs")
    .select("id, user_id, action, resource, metadata, created_at")
    .in("user_id", memberIds)
    .in("action", [...PASSPORT_ACTIVITY_UPDATE_AUDIT_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data?.length) return []

  const logs: PassportActivityLogEntry[] = []
  for (const row of data) {
    const mapped = mapPassportActivityUpdateAuditRow(
      row as {
        id: string
        user_id: string | null
        action: string
        resource: string
        metadata: Record<string, unknown> | null
        created_at: string
      },
      scopedProductIds,
    )
    if (mapped) logs.push(mapped)
  }
  return logs
}

export async function getPassportActivityForUser(userId: string): Promise<{
  summary: PassportActivitySummary
  logs: PassportActivityLogEntry[]
}> {
  const admin = createAdminClient()
  const passportIds = await getScopedPassportIds(userId)
  const productIds = await getScopedProductIds(userId)
  const scopedPassportIds = passportIds.length ? passportIds : [NIL_UUID]
  const scopedProductIds = productIds.length ? productIds : [NIL_UUID]
  const scopedProductIdSet = new Set(productIds)

  const now = Date.now()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalScans },
    { count: scansThisWeek },
    { count: scansPriorWeek },
    { count: passportsGenerated },
    { count: ownershipClaims },
    { data: scanRows },
    { data: passportRows },
    { data: ownershipRows },
    updateAuditRows,
  ] = await Promise.all([
    admin
      .from("passport_scans")
      .select("id", { count: "exact", head: true })
      .in("passport_id", scopedPassportIds),
    admin
      .from("passport_scans")
      .select("id", { count: "exact", head: true })
      .in("passport_id", scopedPassportIds)
      .gte("scan_timestamp", weekAgo),
    admin
      .from("passport_scans")
      .select("id", { count: "exact", head: true })
      .in("passport_id", scopedPassportIds)
      .gte("scan_timestamp", twoWeeksAgo)
      .lt("scan_timestamp", weekAgo),
    admin
      .from("passports")
      .select("id", { count: "exact", head: true })
      .in("product_id", scopedProductIds),
    admin
      .from("ownership_records")
      .select("id", { count: "exact", head: true })
      .in("passport_id", scopedPassportIds),
    admin
      .from("passport_scans")
      .select(
        "id, scan_timestamp, location_city, location_country, passports!inner(serial_number, product_id, products(name))",
      )
      .in("passport_id", scopedPassportIds)
      .order("scan_timestamp", { ascending: false })
      .limit(40),
    admin
      .from("passports")
      .select("id, serial_number, created_at, products(name)")
      .in("product_id", scopedProductIds)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("ownership_records")
      .select("id, claimed_at, passports!inner(serial_number, products(name))")
      .in("passport_id", scopedPassportIds)
      .order("claimed_at", { ascending: false })
      .limit(40),
    fetchPassportUpdateAuditRows(userId, scopedProductIdSet, 40),
  ])

  const summary: PassportActivitySummary = {
    totalScans: totalScans ?? 0,
    passportsGenerated: passportsGenerated ?? 0,
    ownershipClaims: ownershipClaims ?? 0,
    scansTrendLabel: scansTrendLabel(scansThisWeek ?? 0, scansPriorWeek ?? 0),
  }

  const logs: PassportActivityLogEntry[] = []

  for (const row of scanRows ?? []) {
    const sc = row as {
      id: string
      scan_timestamp: string
      location_city: string | null
      location_country: string | null
      passports: {
        serial_number: string | null
        product_id: string
        products: { name: string | null } | { name: string | null }[] | null
      } | {
        serial_number: string | null
        product_id: string
        products: { name: string | null } | { name: string | null }[] | null
      }[] | null
    }
    const passport = Array.isArray(sc.passports) ? sc.passports[0] : sc.passports
    const serial = passport?.serial_number?.trim() || "Unknown serial"
    const where = locationPhrase(sc.location_city, sc.location_country)
    logs.push({
      id: `scan-${sc.id}`,
      eventType: "QR_SCANNED",
      description: `Consumer scanned QR code for ${serial} from ${where}.`,
      targetLabel: serial,
      targetHref: `/verify/${encodeURIComponent(serial)}`,
      occurredAt: sc.scan_timestamp,
      isDemo: false,
    })
  }

  for (const row of passportRows ?? []) {
    const p = row as {
      id: string
      serial_number: string | null
      created_at: string
      products: { name: string | null } | { name: string | null }[] | null
    }
    const product = Array.isArray(p.products) ? p.products[0] : p.products
    const productName = product?.name?.trim() || "Product"
    const serial = p.serial_number?.trim()
    logs.push({
      id: `passport-${p.id}`,
      eventType: "PASSPORT_CREATED",
      description: `Digital passport issued for ${productName}${serial ? ` (${serial})` : ""}.`,
      targetLabel: serial || productName,
      targetHref: "/dashboard/product-passports",
      occurredAt: p.created_at,
      isDemo: false,
    })
  }

  for (const row of ownershipRows ?? []) {
    const o = row as {
      id: string
      claimed_at: string
      passports: {
        serial_number: string | null
        products: { name: string | null } | { name: string | null }[] | null
      } | {
        serial_number: string | null
        products: { name: string | null } | { name: string | null }[] | null
      }[] | null
    }
    const passport = Array.isArray(o.passports) ? o.passports[0] : o.passports
    const serial = passport?.serial_number?.trim() || "Passport"
    const productName = (
      Array.isArray(passport?.products) ? passport.products[0] : passport?.products
    )?.name?.trim()
    logs.push({
      id: `ownership-${o.id}`,
      eventType: "OWNERSHIP_CLAIMED",
      description: `Consumer registered ownership${productName ? ` for ${productName}` : ""}.`,
      targetLabel: serial,
      targetHref: serial ? `/verify/${encodeURIComponent(serial)}` : "/dashboard/product-passports",
      occurredAt: o.claimed_at,
      isDemo: false,
    })
  }

  for (const row of updateAuditRows) {
    logs.push(row)
  }

  logs.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  )

  return { summary, logs: logs.slice(0, 50) }
}
