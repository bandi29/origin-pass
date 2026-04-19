import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUuid } from "@/lib/security"
import { isValidVerifyToken } from "@/lib/verify-token"

export type PassportRecord = {
  id: string
  serial_number: string
  passport_uid: string
  verify_token: string | null
  organization_id?: string | null
  product_id?: string
}

/**
 * Lookup passport by verify_token (secure) or serial_number/passport_uid (legacy).
 * Prefer verify_token when token format matches.
 */
export async function findPassportByTokenOrSerial(
  tokenOrSerial: string
): Promise<PassportRecord | null> {
  const admin = createAdminClient()
  const trimmed = tokenOrSerial.trim()

  const selectFields = "id, serial_number, passport_uid, verify_token, organization_id, product_id"

  if (isValidUuid(trimmed)) {
    const { data: byId, error: errId } = await admin
      .from("passports")
      .select(selectFields)
      .eq("id", trimmed)
      .maybeSingle()
    if (!errId && byId) return byId as PassportRecord
  }

  if (isValidVerifyToken(trimmed)) {
    const { data, error } = await admin
      .from("passports")
      .select(selectFields)
      .eq("verify_token", trimmed)
      .maybeSingle()
    if (!error && data) return data as PassportRecord
  }

  const { data: bySerial, error: errSerial } = await admin
    .from("passports")
    .select(selectFields)
    .eq("serial_number", trimmed)
    .maybeSingle()

  if (!errSerial && bySerial) return bySerial as PassportRecord

  const { data: byUid, error: errUid } = await admin
    .from("passports")
    .select(selectFields)
    .eq("passport_uid", trimmed)
    .maybeSingle()

  if (!errUid && byUid) return byUid as PassportRecord

  return null
}

/** @deprecated Use findPassportByTokenOrSerial */
export async function findPassportBySerial(
  serialNumber: string
): Promise<PassportRecord | null> {
  return findPassportByTokenOrSerial(serialNumber)
}
