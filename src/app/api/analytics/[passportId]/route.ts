import { createClient } from "@/lib/supabase/server"
import { getScopedPassportIds } from "@/backend/modules/organizations/scope"
import { getScanAnalytics } from "@/backend/modules/scan-events/repository"
import { ensureBrandProfile } from "@/lib/tenancy"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ passportId: string }> }
) {
  const { passportId } = await ctx.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureBrandProfile(supabase, user)

  const scoped = await getScopedPassportIds(user.id)
  if (!scoped.includes(passportId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const metrics = await getScanAnalytics(passportId)
  return Response.json(metrics)
}
