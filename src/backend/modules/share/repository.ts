import { createAdminClient } from "@/lib/supabase/admin"
import { hashIpForStorage, truncateUserAgent } from "@/lib/ip-hash"

export type ShareChannel = "whatsapp" | "email" | "direct"

export async function createShareEvent(
  passportId: string,
  channel: ShareChannel
): Promise<{ id: string } | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("share_events")
    .insert({ passport_id: passportId, channel, clicks: 0 })
    .select("id")
    .single()

  if (error || !data?.id) {
    console.warn("createShareEvent:", error?.message)
    return null
  }
  return { id: data.id as string }
}

export async function validateShareBelongsToPassport(
  shareId: string,
  passportId: string
): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("share_events")
    .select("id")
    .eq("id", shareId)
    .eq("passport_id", passportId)
    .maybeSingle()

  if (error) return false
  return !!data?.id
}

export async function recordShareClick(input: {
  shareId: string
  passportId: string
  ip: string | null
  userAgent: string | null
}): Promise<void> {
  const admin = createAdminClient()
  const valid = await validateShareBelongsToPassport(input.shareId, input.passportId)
  if (!valid) return

  const ipHash = hashIpForStorage(input.ip)
  const ua = truncateUserAgent(input.userAgent, 300)

  const { error: insErr } = await admin.from("share_clicks").insert({
    share_id: input.shareId,
    passport_id: input.passportId,
    ip_hash: ipHash,
    user_agent: ua,
  })

  if (insErr) {
    console.warn("recordShareClick insert:", insErr.message)
    return
  }

  // Atomic single-statement increment via SQL function. Replaces the previous
  // read-modify-write which lost increments under concurrent viral-share traffic.
  const { error: rpcErr } = await admin.rpc("increment_share_event_clicks", {
    p_share_id: input.shareId,
  })
  if (rpcErr) {
    // Counter cache is a denormalized convenience — share_clicks is the source of truth.
    // We tolerate the failure and let `getShareAnalytics` recompute from share_clicks.
    console.warn("recordShareClick increment:", rpcErr.message)
  }
}

export async function getShareAnalytics(passportId: string): Promise<{
  totalShares: number
  channels: Record<ShareChannel, number>
  clicks: Record<ShareChannel, number>
}> {
  const admin = createAdminClient()

  // Single SQL round-trip via the SQL function: returns one row per channel with
  // events_count + clicks_count. Avoids selecting every share_events row and the
  // previous N+1 per-row scan.
  const { data, error } = await admin.rpc("get_share_click_counts", {
    p_passport_id: passportId,
  })

  if (error) {
    console.warn("getShareAnalytics:", error.message)
  }

  const channels: Record<ShareChannel, number> = { whatsapp: 0, email: 0, direct: 0 }
  const clicks: Record<ShareChannel, number> = { whatsapp: 0, email: 0, direct: 0 }
  let total = 0

  for (const row of (data ?? []) as Array<{
    channel: string
    events_count: number | string
    clicks_count: number | string
  }>) {
    const ch = row.channel as ShareChannel
    const ev = Number(row.events_count) || 0
    const cl = Number(row.clicks_count) || 0
    total += ev
    if (!(ch in channels)) continue
    channels[ch] = ev
    clicks[ch] = cl
  }

  return { totalShares: total, channels, clicks }
}
