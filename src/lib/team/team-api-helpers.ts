import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { TeamContext } from "@/lib/team/team-context"
import { getActorTeamContext } from "@/lib/team/team-context"
import { getClientIp } from "@/lib/client-ip"

/**
 * Detect whether team tables exist on the connected Supabase project (migration applied).
 */
export async function probeTeamTablesInstalled(
  admin: SupabaseClient,
): Promise<{ ok: true } | { ok: false; missingRelation: boolean; message: string }> {
  const { error } = await admin.from("team_roles").select("id").limit(1)
  if (!error) return { ok: true }
  const msg = (error.message ?? "").toLowerCase()
  const details = typeof error.details === "string" ? error.details.toLowerCase() : ""
  const missingRelation =
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    details.includes("does not exist") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  return { ok: false, missingRelation, message: error.message ?? "unknown error" }
}

export async function requireSessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function requireTeamActor(): Promise<{ userId: string; ctx: TeamContext } | Response> {
  const userId = await requireSessionUserId()
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const ctx = await getActorTeamContext(userId)
  if (!ctx) return Response.json({ error: "No organization context" }, { status: 404 })
  if (ctx.memberStatus !== "active") {
    return Response.json({ error: "Your team access is suspended" }, { status: 403 })
  }
  return { userId, ctx }
}

export function clientIp(request: Request): string | null {
  return getClientIp(request.headers)
}

export function admin() {
  return createAdminClient()
}
