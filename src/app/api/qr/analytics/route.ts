import { createClient } from "@/lib/supabase/server"
import { getQrDashboardPayload } from "@/lib/qr-identity-server-data"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const payload = await getQrDashboardPayload(user.id)
  return Response.json(payload)
}
