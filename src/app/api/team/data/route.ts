import { createAdminClient } from "@/lib/supabase/admin"
import { loadTeamDashboardData } from "@/lib/team/team-dashboard-data"
import { probeTeamTablesInstalled, requireSessionUserId } from "@/lib/team/team-api-helpers"

export async function GET() {
  const userId = await requireSessionUserId()
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return Response.json(
      {
        error:
          "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set. Team APIs require the service role on the server.",
        code: "missing_service_role" as const,
      },
      { status: 503 },
    )
  }

  const admin = createAdminClient()
  const { data: urow } = await admin.from("users").select("organization_id").eq("id", userId).maybeSingle()
  if (!urow?.organization_id) {
    return Response.json({ error: "No organization", code: "no_organization" as const }, { status: 404 })
  }

  const data = await loadTeamDashboardData(userId)
  if (!data) {
    const probe = await probeTeamTablesInstalled(admin)
    if (!probe.ok && probe.missingRelation) {
      return Response.json(
        {
          error:
            "Team tables are not present on this Supabase database. Apply migration 20260426220000_team_management.sql (team_roles, organization_members, …), then refresh.",
          code: "team_schema_missing" as const,
        },
        { status: 503 },
      )
    }
    return Response.json(
      {
        error:
          "Team workspace could not be loaded. Team tables exist, but your membership row could not be created or read. Check server logs; an org owner may need to re-invite you.",
        code: "team_bootstrap_failed" as const,
        ...(process.env.NODE_ENV === "development" && !probe.ok
          ? { debug: probe.message }
          : {}),
      },
      { status: 503 },
    )
  }

  return Response.json(data)
}
