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
 * Lookup passport by verify_token, id, serial_number, or passport_uid in a single
 * round-trip. The previous implementation issued up to four sequential queries,
 * adding ~30–80ms (p95) to every public scan that didn't hit on the first try —
 * which is the common case for serial-style URLs.
 *
 * Each of the four candidate columns is uniquely indexed, so the resulting OR
 * query is a fast bitmap-or across four index probes.
 *
 * Negative lookups (random bot scans) are intentionally not cached here — the
 * scan-redirect path applies its own rate limit, and adding a Redis layer would
 * require careful invalidation on passport creation.
 */
export async function findPassportByTokenOrSerial(
  tokenOrSerial: string
): Promise<PassportRecord | null> {
  const admin = createAdminClient()
  const trimmed = tokenOrSerial.trim()
  if (!trimmed) return null

  const selectFields = "id, serial_number, passport_uid, verify_token, organization_id, product_id"

  // Build an OR filter that only includes column matches the input is shape-eligible
  // for. This keeps the OR tight enough for the planner to choose index scans, and
  // avoids a UUID-comparison error when `trimmed` isn't a UUID.
  const orClauses: string[] = [
    `serial_number.eq.${escapeOr(trimmed)}`,
    `passport_uid.eq.${escapeOr(trimmed)}`,
  ]
  if (isValidVerifyToken(trimmed)) orClauses.push(`verify_token.eq.${escapeOr(trimmed)}`)
  if (isValidUuid(trimmed)) orClauses.push(`id.eq.${trimmed}`)

  const { data, error } = await admin
    .from("passports")
    .select(selectFields)
    .or(orClauses.join(","))
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn("findPassportByTokenOrSerial:", error.message)
    return null
  }
  return (data as PassportRecord | null) ?? null
}

/** Escape characters that have meaning in PostgREST's `or=()` filter syntax. */
function escapeOr(value: string): string {
  // Commas and parens delimit the filter; double-quote any value that contains them.
  if (/[(),"\s]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

/** @deprecated Use findPassportByTokenOrSerial */
export async function findPassportBySerial(
  serialNumber: string
): Promise<PassportRecord | null> {
  return findPassportByTokenOrSerial(serialNumber)
}
