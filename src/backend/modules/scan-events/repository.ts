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

  const { count: total, error: totalErr } = await admin
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .eq("passport_id", passportId)

  if (totalErr) {
    console.warn("getScanAnalytics total:", totalErr.message)
  }

  const { data: rows, error: rowsErr } = await admin
    .from("scan_events")
    .select("scanned_at, ip_hash")
    .eq("passport_id", passportId)
    .order("scanned_at", { ascending: true })
    .limit(50000)

  if (rowsErr) {
    console.warn("getScanAnalytics rows:", rowsErr.message)
    return { totalScans: total ?? 0, uniqueScans: 0, dailyScans: [] }
  }

  const list = rows ?? []
  const uniqueIps = new Set(list.map((r) => r.ip_hash).filter(Boolean))

  const byDay = new Map<string, number>()
  for (const r of list) {
    const d = r.scanned_at ? String(r.scanned_at).slice(0, 10) : ""
    if (!d) continue
    byDay.set(d, (byDay.get(d) ?? 0) + 1)
  }

  const dailyScans = [...byDay.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalScans = typeof total === "number" ? total : list.length

  return {
    totalScans,
    uniqueScans: uniqueIps.size || (list.length ? 1 : 0),
    dailyScans,
  }
}
