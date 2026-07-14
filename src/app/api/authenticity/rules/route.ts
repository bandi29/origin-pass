import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserRole, roleGte } from "@/lib/rbac"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()
  const organizationId = userRow?.organization_id
  if (!organizationId) return Response.json({ rules: [] })

  const { data, error } = await supabase
    .from("verification_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .order("rule_name", { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rules: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = await getUserRole(supabase, user.id)
  if (!roleGte(role, "compliance_manager")) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()
  const organizationId = userRow?.organization_id
  if (!organizationId) return Response.json({ error: "Organization not found" }, { status: 400 })

  const body = (await request.json().catch(() => null)) as {
    rule_name?: string
    rule_type?: string
    rule_description?: string
    threshold_value?: number
    score_impact?: number
    severity?: string
    is_active?: boolean
  } | null
  if (!body?.rule_name || !body?.rule_type) {
    return Response.json({ error: "rule_name and rule_type are required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("verification_rules")
    .insert({
      organization_id: organizationId,
      rule_name: body.rule_name,
      rule_type: body.rule_type,
      rule_description: body.rule_description ?? null,
      threshold_value: body.threshold_value ?? null,
      score_impact: body.score_impact ?? 0,
      severity: body.severity ?? "medium",
      is_active: body.is_active ?? true,
    })
    .select("*")
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ rule: data }, { status: 201 })
}
