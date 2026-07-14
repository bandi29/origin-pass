import { createClient } from "@/lib/supabase/server"
import {
  getInvestigationSummary,
  listInvestigationAlerts,
  syncCounterfeitAlertsFromScans,
} from "@/lib/counterfeit-alerts-server"

const SYNC_INTERVAL_MS = 60_000
const lastSyncAt = new Map<string, number>()

function shouldRunSync(userId: string): boolean {
  const now = Date.now()
  const prev = lastSyncAt.get(userId) ?? 0
  if (now - prev < SYNC_INTERVAL_MS) return false
  lastSyncAt.set(userId, now)
  if (lastSyncAt.size > 5000) {
    for (const [k, t] of lastSyncAt) {
      if (now - t > SYNC_INTERVAL_MS * 5) lastSyncAt.delete(k)
    }
  }
  return true
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  if (shouldRunSync(user.id)) {
    // Fire-and-forget so the dashboard loads fast; consumers reading alerts immediately after
    // will see the previous sync's results until the next GET that crosses the debounce window.
    syncCounterfeitAlertsFromScans(user.id).catch((err) => {
      console.warn("syncCounterfeitAlertsFromScans:", err instanceof Error ? err.message : err)
    })
  }

  const { searchParams } = new URL(request.url)
  const feed = searchParams.get("feed") === "1"
  const limit = Math.min(120, Math.max(10, Number(searchParams.get("limit") ?? 60) || 60))

  if (feed) {
    const rows = await listInvestigationAlerts(user.id, 12, { skipSync: true })
    return Response.json({
      feed: rows.map((r) => ({
        id: r.id,
        ref: r.investigation_ref,
        issue_type: r.issue_type,
        severity: r.severity,
        status: r.status,
        confidence: r.confidence_score,
        created_at: r.created_at,
        region: r.region,
      })),
    })
  }

  const [alerts, summary] = await Promise.all([
    listInvestigationAlerts(user.id, limit, { skipSync: true }),
    getInvestigationSummary(user.id),
  ])

  return Response.json({ alerts, summary })
}
