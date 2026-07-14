import { loadEnvLocalIntoProcess } from "@/lib/env-local-file"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  filterJobLinkedPassportRows,
  passportCreatedDuringJob,
} from "@/lib/passport-batch-export-resolver"

async function main() {
  loadEnvLocalIntoProcess()
  const admin = createAdminClient()

  const { data: jobs } = await admin
    .from("qr_batch_jobs")
    .select(
      "id, job_name, metadata, started_at, completed_at, input_count, success_count, created_by, organization_id",
    )
    .order("created_at", { ascending: false })
    .limit(2)

  for (const job of jobs ?? []) {
    console.log("\n===", job.job_name, job.id, "===")
    console.log("started_at:", job.started_at)
    console.log("completed_at:", job.completed_at)
    const metadata = job.metadata ?? {}
    console.log("import_passport_ids:", metadata.import_passport_ids)
    console.log("passport_ids:", metadata.passport_ids)

    const importIds = metadata.import_passport_ids ?? metadata.passport_ids ?? []
    if (importIds.length) {
      const { data: rows } = await admin
        .from("passports")
        .select("id, serial_number, created_at, metadata, product_id")
        .in("id", importIds)

      for (const row of rows ?? []) {
        console.log({
          id: row.id,
          serial: row.serial_number,
          created_at: row.created_at,
          qr_batch_job_id: row.metadata?.qr_batch_job_id,
          createdDuringJob: passportCreatedDuringJob(job, row),
        })
      }
    }

    const { data: linked } = await admin
      .from("passports")
      .select("id, serial_number, created_at, metadata")
      .filter("metadata->>qr_batch_job_id", "eq", job.id)

    console.log("job link query count:", linked?.length ?? 0)
    console.log(
      "job link after filter:",
      filterJobLinkedPassportRows(job, linked ?? []).map((r) => r.serial_number ?? r.id),
    )
  }
}

main().catch(console.error)
