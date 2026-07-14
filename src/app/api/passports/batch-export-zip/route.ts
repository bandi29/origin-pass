import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUuid } from "@/lib/security"
import {
  buildPassportLabelsZip,
  buildBatchExportFolderName,
  loadPassportsForExport,
  persistBatchExportMetadata,
  resolvePassportIdsForJob,
  assertBatchJobExportAccess,
  type BatchJobMetadata,
} from "@/lib/passport-batch-export-server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const batchId = searchParams.get("batchId")?.trim() ?? ""
  if (!isValidUuid(batchId)) {
    return Response.json({ error: "Valid batchId query parameter is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { data: job, error: jobError } = await supabase
    .from("qr_batch_jobs")
    .select(
      "id, job_name, metadata, status, organization_id, created_by, started_at, completed_at, input_count, success_count",
    )
    .eq("id", batchId)
    .eq("created_by", user.id)
    .maybeSingle()

  if (jobError || !job) {
    return Response.json({ error: "Batch job not found" }, { status: 404 })
  }

  const metadata = (job.metadata ?? {}) as BatchJobMetadata
  const admin = createAdminClient()

  const allowed = await assertBatchJobExportAccess(admin, user.id, job)
  if (!allowed) {
    return Response.json({ error: "Batch job not found" }, { status: 404 })
  }

  const passportIds = await resolvePassportIdsForJob(admin, job, metadata)
  if (passportIds.length === 0) {
    return Response.json(
      { error: "No passport labels in this batch", code: "ASSETS_NOT_READY" },
      { status: 400 },
    )
  }

  const passports = await loadPassportsForExport(admin, passportIds)
  if (!passports?.length) {
    return Response.json({ error: "Could not load passports for batch" }, { status: 404 })
  }

  try {
    const folderName = buildBatchExportFolderName(job, metadata)
    const { zipBuffer, filename, fileCount } = await buildPassportLabelsZip(batchId, passports, {
      folderName,
    })
    await persistBatchExportMetadata(admin, batchId, metadata, passportIds, job)

    const blob = new Blob([zipBuffer as BlobPart], { type: "application/zip" })
    return new Response(blob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-OriginPass-Label-Count": String(fileCount),
      },
    })
  } catch {
    return Response.json({ error: "Failed to build label archive" }, { status: 500 })
  }
}
