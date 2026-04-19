"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import type { PassportRecord } from "@/backend/modules/passports/repository"
import { isValidVerifyToken } from "@/lib/verify-token"
import { isValidSerialId, isValidUuid } from "@/lib/security"

export type ClaimOwnershipInput = {
  tokenOrSerial: string
  ownerIdentifier: string
  ownerName?: string
  userId?: string | null
}

export type ClaimOwnershipResult = {
  success: boolean
  ownershipId?: string
  error?: string
}

export type OwnershipRecord = {
  id: string
  passport_id: string
  owner_identifier: string | null
  owner_name: string | null
  status: string
  claimed_at: string
  warranty_start_date: string | null
  warranty_end_date: string | null
}

async function resolveOrganizationId(passport: PassportRecord): Promise<string | null> {
  if (passport.organization_id) return passport.organization_id
  if (!passport.product_id) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from("products")
    .select("organization_id")
    .eq("id", passport.product_id)
    .maybeSingle()
  return (data?.organization_id as string | null) ?? null
}

/**
 * Claim ownership of a passport.
 * Rules: one active owner; new claim marks previous as transferred.
 */
export async function claimOwnership(
  input: ClaimOwnershipInput
): Promise<ClaimOwnershipResult> {
  const identifier = input.ownerIdentifier?.trim()
  if (!identifier) {
    return { success: false, error: "Email or phone is required." }
  }

  const token = input.tokenOrSerial.trim()
  const isValid =
    isValidVerifyToken(token) || isValidSerialId(token) || isValidUuid(token)
  if (!isValid) {
    return { success: false, error: "Invalid token or serial." }
  }

  const passport = await findPassportByTokenOrSerial(token)
  if (!passport) {
    return { success: false, error: "Passport not found." }
  }

  const organizationId = await resolveOrganizationId(passport)

  const admin = createAdminClient()

  // Mark previous active owner(s) as transferred
  await admin
    .from("ownership_records")
    .update({ status: "transferred" })
    .eq("passport_id", passport.id)
    .eq("status", "claimed")

  const now = new Date()
  const warrantyStart = now.toISOString().slice(0, 10)

  const insertPayload: Record<string, unknown> = {
    passport_id: passport.id,
    owner_identifier: identifier,
    owner_name: input.ownerName?.trim() || null,
    owner_email: identifier.includes("@") ? identifier : null,
    status: "claimed",
    warranty_start_date: warrantyStart,
    metadata: input.userId ? { user_id: input.userId } : {},
  }
  if (organizationId) {
    insertPayload.organization_id = organizationId
  }

  const { data, error } = await admin
    .from("ownership_records")
    .insert(insertPayload)
    .select("id")
    .single()

  if (error) {
    console.warn("claimOwnership error:", error.message)
    return { success: false, error: error.message }
  }

  return {
    success: true,
    ownershipId: data?.id,
  }
}

/**
 * Get current owner and ownership history for a passport.
 */
export async function getOwnershipForPassport(
  passportId: string
): Promise<{
  current: OwnershipRecord | null
  history: OwnershipRecord[]
}> {
  const admin = createAdminClient()

  const { data: records, error } = await admin
    .from("ownership_records")
    .select("id, passport_id, owner_identifier, owner_name, status, claimed_at, warranty_start_date, warranty_end_date")
    .eq("passport_id", passportId)
    .order("claimed_at", { ascending: false })

  if (error || !records) {
    return { current: null, history: [] }
  }

  const current = records.find((r) => r.status === "claimed") ?? null
  return {
    current: current as OwnershipRecord | null,
    history: records as OwnershipRecord[],
  }
}

/**
 * Resolve token/serial to passport_id for claim flow.
 */
export async function resolvePassportId(tokenOrSerial: string): Promise<string | null> {
  const passport = await findPassportByTokenOrSerial(tokenOrSerial)
  return passport?.id ?? null
}

export type OwnershipWithProduct = OwnershipRecord & {
  product_name?: string | null
  brand_name?: string | null
  serial_id?: string | null
}

/**
 * Get ownership records for an owner (by email or phone).
 * Returns active and transferred records with product info.
 */
export async function getOwnershipByOwner(
  ownerIdentifier: string
): Promise<OwnershipWithProduct[]> {
  const identifier = ownerIdentifier?.trim()
  if (!identifier) return []

  const admin = createAdminClient()

  const { data: records, error } = await admin
    .from("ownership_records")
    .select(`
      id, passport_id, owner_identifier, owner_name, status, claimed_at,
      warranty_start_date, warranty_end_date,
      passports!inner(serial_number, verify_token, products(name, profiles(brand_name)))
    `)
    .or(`owner_identifier.eq.${identifier},owner_email.eq.${identifier}`)
    .order("claimed_at", { ascending: false })

  if (error || !records) return []

  return records.map((r: Record<string, unknown>) => {
    const p = r.passports as Record<string, unknown> | null
    const prod = (p?.products as Record<string, unknown>) ?? {}
    const profile = (prod?.profiles as Record<string, unknown>) ?? {}
    const serialId = (p?.verify_token ?? p?.serial_number) as string | null
    return {
      id: r.id,
      passport_id: r.passport_id,
      owner_identifier: r.owner_identifier,
      owner_name: r.owner_name,
      status: r.status,
      claimed_at: r.claimed_at,
      warranty_start_date: r.warranty_start_date,
      warranty_end_date: r.warranty_end_date,
      product_name: prod?.name ?? null,
      brand_name: profile?.brand_name ?? null,
      serial_id: serialId ?? null,
    } as OwnershipWithProduct
  })
}
