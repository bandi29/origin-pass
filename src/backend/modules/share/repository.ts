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

  const { data: row } = await admin
    .from("share_events")
    .select("clicks")
    .eq("id", input.shareId)
    .single()
  const next = (typeof row?.clicks === "number" ? row.clicks : 0) + 1
  await admin.from("share_events").update({ clicks: next }).eq("id", input.shareId)
}

export async function getShareAnalytics(passportId: string): Promise<{
  totalShares: number
  channels: Record<ShareChannel, number>
  clicks: Record<ShareChannel, number>
}> {
  const admin = createAdminClient()

  const { data: events, error: evErr } = await admin
    .from("share_events")
    .select("channel, clicks")
    .eq("passport_id", passportId)

  if (evErr) {
    console.warn("getShareAnalytics events:", evErr.message)
  }

  const channels: Record<ShareChannel, number> = {
    whatsapp: 0,
    email: 0,
    direct: 0,
  }
  const clicks: Record<ShareChannel, number> = {
    whatsapp: 0,
    email: 0,
    direct: 0,
  }

  for (const row of events ?? []) {
    const ch = row.channel as ShareChannel
    if (!(ch in channels)) continue
    channels[ch]++
    clicks[ch] += typeof row.clicks === "number" ? row.clicks : 0
  }

  return {
    totalShares: events?.length ?? 0,
    channels,
    clicks,
  }
}
