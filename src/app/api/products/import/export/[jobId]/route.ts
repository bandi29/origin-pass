import { createClient } from "@/lib/supabase/server"
import {
  buildImportQrExportCsv,
  readPipelineFromMapping,
} from "@/lib/import-products/import-catalog-pipeline"

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
    .select("id, file_name, product_import_log_id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !job?.product_import_log_id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { data: log, error: logError } = await supabase
    .from("product_import_logs")
    .select("mapping")
    .eq("id", job.product_import_log_id)
    .maybeSingle()

  if (logError || !log) {
    return Response.json({ error: "Import log not found" }, { status: 404 })
  }

  const pipeline = readPipelineFromMapping(log.mapping)
  if (!pipeline?.exportReady || pipeline.exportRows.length === 0) {
    return Response.json({ error: "QR export is not ready for this import yet." }, { status: 400 })
  }

  const csv = buildImportQrExportCsv(pipeline.exportRows)
  const baseName =
    typeof job.file_name === "string" && job.file_name.trim()
      ? job.file_name.replace(/\.(csv|xlsx)$/i, "")
      : "originpass-import"
  const filename = `${baseName}-qr-export.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
