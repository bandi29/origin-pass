import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole, roleGte } from "@/lib/rbac"

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "event_type,event_message,risk_before,risk_after,triggered_at\n"
  const headers = Object.keys(rows[0]!)
  const lines = [headers.join(",")]
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const value = row[h]
          const text = value == null ? "" : String(value)
          return `"${text.replace(/"/g, '""')}"`
        })
        .join(","),
    )
  }
  return lines.join("\n")
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = await getUserRole(supabase, user.id)
  if (!roleGte(role, "compliance_manager")) {
    return Response.json({ error: "Only compliance managers or above can export audit logs." }, { status: 403 })
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()
  const organizationId = userRow?.organization_id
  if (!organizationId) return Response.json({ error: "Organization not found" }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("verification_events")
    .select("event_type, event_message, risk_before, risk_after, score_change, triggered_at")
    .eq("organization_id", organizationId)
    .order("triggered_at", { ascending: false })
    .limit(5000)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const csv = toCsv((data ?? []) as Array<Record<string, unknown>>)
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=authenticity-audit-export.csv",
    },
  })
}
