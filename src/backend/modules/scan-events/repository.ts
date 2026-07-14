import { createAdminClient } from "@/lib/supabase/admin"
import { hashIpForStorage, truncateUserAgent } from "@/lib/ip-hash"

const DEDUPE_MS = 4000

export async function insertScanEventDeduped(input: {
  passportId: string
  ip: string | null
  country: string | null
  userAgent: string | null
}): Promise<boolean> {
  const admin = createAdminClient()
  const ipHash = hashIpForStorage(input.ip)
  const device = truncateUserAgent(input.userAgent)
  const since = new Date(Date.now() - DEDUPE_MS).toISOString()

  if (ipHash) {
    const { data: recent } = await admin
      .from("scan_events")
      .select("id")
      .eq("passport_id", input.passportId)
      .eq("ip_hash", ipHash)
      .gte("scanned_at", since)
      .limit(1)
      .maybeSingle()

    if (recent?.id) return false
  }

  const { error } = await admin.from("scan_events").insert({
    passport_id: input.passportId,
    ip_hash: ipHash,
    country: input.country?.slice(0, 80) ?? null,
    device,
  })

  if (error) {
    console.warn("insertScanEventDeduped:", error.message)
    return false
  }
  return true
}

export async function getScanAnalytics(passportId: string): Promise<{
  totalScans: number
  uniqueScans: number
  dailyScans: { date: string; count: number }[]
}> {
  const admin = createAdminClient()

  // Single SQL round-trip: returns aggregated totals + per-day buckets as JSONB.
  // Replaces the previous pattern of selecting up to 50k raw rows and bucketing in Node
  // (which silently truncated for viral passports and shipped MB per dashboard view).
  const { data, error } = await admin
    .rpc("scan_analytics_for_passport", { p_passport_id: passportId })
    .maybeSingle()

  if (error) {
    console.warn("getScanAnalytics rpc:", error.message)
    return { totalScans: 0, uniqueScans: 0, dailyScans: [] }
  }

  if (!data) {
    return { totalScans: 0, uniqueScans: 0, dailyScans: [] }
  }

  const row = data as {
    total_scans: number | string | null
    unique_ips: number | string | null
    daily_scans: Array<{ date: string; count: number | string }> | null
  }

  const dailyScans = Array.isArray(row.daily_scans)
    ? row.daily_scans
        .map((d) => ({ date: String(d.date), count: Number(d.count) || 0 }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : []

  return {
    totalScans: Number(row.total_scans) || 0,
    uniqueScans: Number(row.unique_ips) || 0,
    dailyScans,
  }
}
