import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { getAuthenticatedUser } from "@/backend/modules/auth/service"
import {
  NIL_UUID,
  getScopedPassportIds,
} from "@/backend/modules/organizations/scope"
import { createAdminClient } from "@/lib/supabase/admin"

type ScanRow = {
  id: string
  scan_timestamp: string
  location_country: string | null
  location_city: string | null
  device_type: string | null
  ip_address: string | null
  scan_result: string
  risk_score: number | null
  passport: { id?: string; serial_number?: string } | { id?: string; serial_number?: string }[] | null
}

export async function GET() {
  const ctx = await buildRequestContext()
  const user = await getAuthenticatedUser()
  if (!user) return fail(ctx.traceId, "Unauthorized.", 401)

  const passportIds = await getScopedPassportIds(user.id)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("passport_scans")
    .select(
      "id, scan_timestamp, location_country, location_city, device_type, ip_address, scan_result, risk_score, passport:passports(id,serial_number)"
    )
    .in("passport_id", passportIds.length ? passportIds : [NIL_UUID])
    .order("scan_timestamp", { ascending: false })
    .limit(200)

  if (error) return fail(ctx.traceId, "Failed to fetch scans.", 500)

  const scans = ((data ?? []) as ScanRow[]).map((row) => {
    const passport = Array.isArray(row.passport) ? row.passport[0] : row.passport
    return {
      id: row.id,
      scanTimestamp: row.scan_timestamp,
      passportId: passport?.id || null,
      passportSerial: passport?.serial_number || null,
      result: row.scan_result,
      riskScore: row.risk_score,
      location: {
        city: row.location_city,
        country: row.location_country,
      },
      deviceType: row.device_type,
      ipAddress: row.ip_address,
    }
  })

  return ok(ctx.traceId, { scans })
}
