import { createAdminClient } from "@/lib/supabase/admin"
import {
  getScopedOrgId,
  getScopedPassportIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"
import type {
  OwnershipRecordRow,
  OwnershipWarrantyStatus,
} from "@/lib/ownership-records-types"

const LEDGER_LIMIT = 500

type DbOwnershipRow = {
  id: string
  owner_identifier: string | null
  owner_name: string | null
  owner_email: string | null
  status: string
  claimed_at: string
  warranty_start_date: string | null
  warranty_end_date: string | null
  metadata: Record<string, unknown> | null
  passports:
    | {
        serial_number: string | null
        products: { name: string | null; sku: string | null } | { name: string | null; sku: string | null }[] | null
      }
    | {
        serial_number: string | null
        products: { name: string | null; sku: string | null } | { name: string | null; sku: string | null }[] | null
      }[]
    | null
}

export function formatOwnershipRegistrationId(id: string): string {
  return `OWN-${String(id).replace(/-/g, "").slice(0, 9).toUpperCase()}`
}

export function maskVerifiedOwnerLabel(input: {
  ownerIdentifier: string | null
  ownerName: string | null
  ownerEmail: string | null
  metadata?: Record<string, unknown> | null
}): string {
  const identifier =
    input.ownerIdentifier?.trim() ||
    input.ownerEmail?.trim() ||
    input.ownerName?.trim() ||
    ""

  const meta = input.metadata ?? {}
  const city = typeof meta.claim_city === "string" ? meta.claim_city.trim() : ""
  const country = typeof meta.claim_country === "string" ? meta.claim_country.trim() : ""
  const locationSuffix =
    city && country ? ` · ${city}, ${country}` : country ? ` · ${country}` : city ? ` · ${city}` : ""

  if (!identifier) return `Verified owner${locationSuffix}`

  if (identifier.includes("@")) {
    const [local, domain] = identifier.split("@")
    if (!domain) return `Verified owner${locationSuffix}`
    const visible = local.slice(0, Math.min(4, local.length))
    return `${visible}••••@${domain}${locationSuffix}`
  }

  if (/^u-\d+/i.test(identifier)) {
    return `${identifier}${locationSuffix}`
  }

  if (identifier.length > 6) {
    return `${identifier.slice(0, 2)}••••${identifier.slice(-2)}${locationSuffix}`
  }

  return `${identifier}${locationSuffix}`
}

export function resolveOwnershipWarrantyStatus(
  warrantyStart: string | null,
  warrantyEnd: string | null,
  now: Date = new Date(),
): { status: OwnershipWarrantyStatus; expiresAt: string | null } {
  if (!warrantyStart) {
    return { status: "pending", expiresAt: warrantyEnd }
  }

  if (warrantyEnd) {
    const end = new Date(`${warrantyEnd}T23:59:59.999Z`)
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
      return { status: "expired", expiresAt: warrantyEnd }
    }
    return { status: "active", expiresAt: warrantyEnd }
  }

  return { status: "active", expiresAt: null }
}

function unwrapProduct(
  products: DbOwnershipRow["passports"],
): { name: string | null; sku: string | null } | null {
  const passport = Array.isArray(products) ? products[0] : products
  if (!passport) return null
  const raw = passport.products
  return Array.isArray(raw) ? (raw[0] ?? null) : raw
}

export function mapOwnershipRecordRow(row: DbOwnershipRow): OwnershipRecordRow {
  const product = unwrapProduct(row.passports)
  const passport = Array.isArray(row.passports) ? row.passports[0] : row.passports
  const warranty = resolveOwnershipWarrantyStatus(
    row.warranty_start_date,
    row.warranty_end_date,
  )

  const productName = product?.name?.trim() || "Unknown product"
  const productSku =
    product?.sku?.trim() || passport?.serial_number?.trim() || "—"

  return {
    id: row.id,
    registrationId: formatOwnershipRegistrationId(row.id),
    productSku,
    productName,
    ownerLabel: maskVerifiedOwnerLabel({
      ownerIdentifier: row.owner_identifier,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
      metadata: row.metadata,
    }),
    warrantyStatus: warranty.status,
    warrantyExpiresAt: warranty.expiresAt,
    registeredAt: row.claimed_at,
  }
}

/**
 * Org-scoped ownership ledger for the dashboard Registration table.
 * Returns active (`claimed`) registrations only, newest first.
 */
export async function getOwnershipRecordsForUser(userId: string): Promise<OwnershipRecordRow[]> {
  const admin = createAdminClient()
  const orgId = await getScopedOrgId(userId)

  const select = `
    id, owner_identifier, owner_name, owner_email, status, claimed_at,
    warranty_start_date, warranty_end_date, metadata,
    passports!inner(serial_number, products(name, sku))
  `

  let query = admin
    .from("ownership_records")
    .select(select)
    .eq("status", "claimed")
    .order("claimed_at", { ascending: false })
    .limit(LEDGER_LIMIT)

  if (orgId) {
    query = query.eq("organization_id", orgId)
  } else {
    const passportIds = await getScopedPassportIds(userId)
    const scoped = passportIds.length ? passportIds : [NIL_UUID]
    query = query.in("passport_id", scoped)
  }

  const { data, error } = await query

  if (error) {
    console.warn("getOwnershipRecordsForUser error:", error.message)
    return []
  }

  return ((data ?? []) as DbOwnershipRow[]).map(mapOwnershipRecordRow)
}
