import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type Params = { jobId: string }

export async function GET(_req: Request, context: { params: Promise<Params> }) {
  const { jobId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: job, error } = await supabase
    .from("import_jobs")
    .select(
      "id, status, total_rows, processed_rows, success_count, failure_count, product_import_log_id, file_name, last_error, updated_at",
    )
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !job) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const total = job.total_rows ?? 0
  const processed = job.processed_rows ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0

  return Response.json({
    jobId: job.id,
    status: job.status,
    fileName: job.file_name,
    totalRows: total,
    processedRows: processed,
    successCount: job.success_count ?? 0,
    failureCount: job.failure_count ?? 0,
    percent: pct,
    productImportLogId: job.product_import_log_id,
    lastError: job.last_error,
    updatedAt: job.updated_at,
  })
}
