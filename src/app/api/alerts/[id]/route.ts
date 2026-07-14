import { createClient } from "@/lib/supabase/server"
import { getInvestigationAlertDetail } from "@/lib/counterfeit-alerts-server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params
  const detail = await getInvestigationAlertDetail(user.id, id)
  if (!detail) return Response.json({ error: "Not found" }, { status: 404 })
  return Response.json({ alert: detail })
}
