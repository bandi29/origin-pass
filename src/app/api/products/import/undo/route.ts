import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureBrandProfile(supabase, user)

  let body: { importLogId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const importLogId = body.importLogId?.trim()
  if (!importLogId) {
    return Response.json({ error: "importLogId required" }, { status: 400 })
  }

  const { data: log } = await supabase
    .from("product_import_logs")
    .select("id, brand_id, status")
    .eq("id", importLogId)
    .maybeSingle()

  if (!log || log.brand_id !== user.id) {
    return Response.json({ error: "Import log not found" }, { status: 404 })
  }

  const alreadyReverted = String(log.status ?? "") === "reverted"
  if (alreadyReverted) {
    return Response.json({ archivedCount: 0, alreadyReverted: true })
  }

  /** Only rows still active — avoids counting the same products again on repeat undo. */
  const { data: updated, error } = await supabase
    .from("products")
    .update({ is_archived: true })
    .eq("import_log_id", importLogId)
    .eq("brand_id", user.id)
    .eq("is_archived", false)
    .select("id")

  if (error) {
    console.error("undo import", error)
    return Response.json({ error: "Could not archive imported products." }, { status: 500 })
  }

  const archivedCount = updated?.length ?? 0

  await supabase
    .from("product_import_logs")
    .update({ status: "reverted" })
    .eq("id", importLogId)
    .eq("brand_id", user.id)

  return Response.json({ archivedCount, alreadyReverted: false })
}
