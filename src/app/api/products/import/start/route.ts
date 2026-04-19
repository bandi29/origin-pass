import type { ColumnMapping } from "@/lib/import-products/types"
import { REQUIRED_IMPORT_FIELDS } from "@/lib/import-products/types"
import { isMappingComplete } from "@/lib/import-products/mapping"
import { checkRateLimit } from "@/lib/import-products/rate-limit"
import { enqueueProductImport } from "@/lib/import-products/queue"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"

export const runtime = "nodejs"

const START_PER_MIN = 5

type Body = {
  sessionId?: string
  mapping?: ColumnMapping
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = checkRateLimit(`import-start:${user.id}`, START_PER_MIN, 60_000)
  if (!rl.ok) {
    return Response.json(
      { error: "Too many import starts. Wait a minute and try again.", retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    )
  }

  await ensureBrandProfile(supabase, user)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const jobId = body.sessionId?.trim()
  const mapping = body.mapping
  if (!jobId || !mapping) {
    return Response.json({ error: "sessionId and mapping are required" }, { status: 400 })
  }

  const complete = isMappingComplete(mapping, REQUIRED_IMPORT_FIELDS)
  if (!complete.ok) {
    return Response.json({ error: "Complete field mapping before import.", missing: complete.missing }, { status: 400 })
  }

  const { data: job, error: jErr } = await supabase
    .from("import_jobs")
    .select("id, user_id, status, file_url")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (jErr || !job) {
    return Response.json({ error: "Import job not found. Upload again." }, { status: 404 })
  }

  if (job.status === "PROCESSING") {
    return Response.json({ error: "Import already running.", jobId }, { status: 409 })
  }
  if (job.status === "COMPLETED") {
    return Response.json({ error: "This import already completed. Upload a new file to import again." }, { status: 409 })
  }

  const mappingJson = mapping as unknown as Record<string, unknown>
  const now = new Date().toISOString()

  if (job.status === "FAILED" || job.status === "PARTIAL_SUCCESS") {
    await supabase.from("import_errors").delete().eq("job_id", jobId)
    const { data: retryRow, error: retryErr } = await supabase
      .from("import_jobs")
      .update({
        mapping: mappingJson,
        success_count: 0,
        failure_count: 0,
        processed_rows: 0,
        last_error: null,
        product_import_log_id: null,
        status: "PROCESSING",
        updated_at: now,
      })
      .eq("id", jobId)
      .eq("user_id", user.id)
      .in("status", ["FAILED", "PARTIAL_SUCCESS"])
      .select("id")
      .maybeSingle()

    if (retryErr || !retryRow?.id) {
      return Response.json(
        { error: "Could not restart this import. Refresh and try again." },
        { status: 409 },
      )
    }
  } else {
    const { data: started, error: upErr } = await supabase
      .from("import_jobs")
      .update({
        mapping: mappingJson,
        status: "PROCESSING",
        updated_at: now,
      })
      .eq("id", jobId)
      .eq("user_id", user.id)
      .eq("status", "UPLOADED")
      .select("id")
      .maybeSingle()

    if (upErr) {
      console.error("import job update", upErr)
      return Response.json({ error: "Could not update job." }, { status: 500 })
    }
    if (!started?.id) {
      return Response.json(
        { error: "Import could not be started. It may already be processing." },
        { status: 409 },
      )
    }
  }

  await enqueueProductImport(jobId)

  return Response.json(
    {
      ok: true,
      async: true,
      jobId,
      importLogId: null as string | null,
      message: "Import queued. Poll /api/products/import/status for progress.",
    },
    { status: 202 },
  )
}
