import { createClient } from "@/lib/supabase/server"
import { buildBatchExportFolderName } from "@/lib/passport-batch-export-resolver"

export type BatchHistoryRow = {
  id: string
  recordCount: number
  inputCount?: number
  successCount?: number
  status: "completed" | "queued" | "processing" | "failed"
  createdAt: string
  jobName: string | null
  exportFolderName?: string | null
  hasBeenExported?: boolean
  assetsGenerated?: boolean
}

function mapStatus(raw: string): BatchHistoryRow["status"] {
  if (raw === "completed" || raw === "partial_success") return "completed"
  if (raw === "failed") return "failed"
  if (raw === "processing") return "processing"
  return "queued"
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("qr_batch_jobs")
    .select("id, input_count, success_count, status, created_at, job_name, metadata")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const jobs: BatchHistoryRow[] = (data ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as {
      labels_exported_at?: string | null
      assets_generated_at?: string | null
      export_folder_name?: string | null
      passport_ids?: string[]
      import_passport_ids?: string[]
    }
    const successCount = (row.success_count as number | null) ?? 0
    const inputCount = (row.input_count as number | null) ?? 0
    const labelCount = successCount > 0 ? successCount : inputCount

    return {
      id: row.id as string,
      recordCount: labelCount,
      inputCount,
      successCount,
      status: mapStatus(String(row.status ?? "queued")),
      createdAt: row.created_at as string,
      jobName: (row.job_name as string | null) ?? null,
      exportFolderName: buildBatchExportFolderName(
        { id: row.id as string, job_name: (row.job_name as string | null) ?? null },
        metadata,
      ),
      hasBeenExported: Boolean(metadata.labels_exported_at),
      assetsGenerated:
        Boolean(metadata.assets_generated_at) ||
        (mapStatus(String(row.status ?? "queued")) === "completed" && successCount > 0),
    }
  })

  return Response.json({ jobs })
}
