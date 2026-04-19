import { createAdminClient } from "@/lib/supabase/admin"

export async function countRecentScans(
  passportId: string,
  minutes: number
): Promise<number> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()

  const { count, error } = await admin
    .from("passport_scans")
    .select("id", { head: true, count: "exact" })
    .eq("passport_id", passportId)
    .gte("scan_timestamp", since)

  if (error) {
    console.warn("countRecentScans error:", error.message)
    return 0
  }

  return count ?? 0
}

export async function countRecentScansByIp(
  passportId: string,
  ipAddress: string | null,
  minutes: number
): Promise<number> {
  if (!ipAddress) return 0
  const admin = createAdminClient()
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString()

  const { count, error } = await admin
    .from("passport_scans")
    .select("id", { head: true, count: "exact" })
    .eq("passport_id", passportId)
    .eq("ip_address", ipAddress)
    .gte("scan_timestamp", since)

  if (error) {
    console.warn("countRecentScansByIp error:", error.message)
    return 0
  }

  return count ?? 0
}


export async function countDistinctCountriesLastHour(
  passportId: string
): Promise<number> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from("passport_scans")
    .select("location_country")
    .eq("passport_id", passportId)
    .gte("scan_timestamp", since)
    .not("location_country", "is", null)

  if (error) return 0

  const countries = new Set(
    (data ?? []).map((r) => (r.location_country ?? "").toUpperCase()).filter(Boolean)
  )
  return countries.size
}

export async function getFirstScanDate(
  passportId: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passport_scans")
    .select("scan_timestamp")
    .eq("passport_id", passportId)
    .order("scan_timestamp", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.scan_timestamp
}

export async function getTotalScanCount(passportId: string): Promise<number> {
  const admin = createAdminClient()
  const { count, error } = await admin
    .from("passport_scans")
    .select("id", { head: true, count: "exact" })
    .eq("passport_id", passportId)

  if (error) return 0
  return count ?? 0
}

export async function countScansLastMinute(passportId: string): Promise<number> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 60 * 1000).toISOString()

  const { count, error } = await admin
    .from("passport_scans")
    .select("id", { head: true, count: "exact" })
    .eq("passport_id", passportId)
    .gte("scan_timestamp", since)

  if (error) return 0
  return count ?? 0
}
