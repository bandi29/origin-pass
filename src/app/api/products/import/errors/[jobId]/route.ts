import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type Params = { jobId: string }

export async function GET(req: Request, context: { params: Promise<Params> }) {
  const { jobId } = await context.params
  const url = new URL(req.url)
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100))
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: job, error: jErr } = await supabase
    .from("import_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (jErr || !job) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { data: rows, error, count } = await supabase
    .from("import_errors")
    .select("id, row_number, error_message, raw_data", { count: "exact" })
    .eq("job_id", jobId)
    .order("row_number", { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("import_errors", error)
    return Response.json({ error: "Could not load errors" }, { status: 500 })
  }

  return Response.json({
    jobId,
    total: count ?? rows?.length ?? 0,
    offset,
    limit,
    errors: rows ?? [],
  })
}
