import { loadEnvLocalIntoProcess } from "@/lib/env-local-file"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  resolvePassportIdsForJob,
  loadPassportsForExport,
  type BatchJobMetadata,
} from "@/lib/passport-batch-export-server"

type JobInspectionFailure = { jobId: string; error: string }
type JobInspectionSuccess = {
  jobId: string
  jobName: string | null
  status: string | null
  successCount: number | null
  importPassportCount: number
  resolvedCount: number
  passportIds: string[]
  serialNumbers: (string | null)[]
}
type JobInspection = JobInspectionFailure | JobInspectionSuccess

async function inspectJob(
  admin: ReturnType<typeof createAdminClient>,
  jobId: string,
): Promise<JobInspection> {
  const { data: job, error } = await admin
    .from("qr_batch_jobs")
    .select(
      "id, job_name, metadata, status, organization_id, created_by, started_at, completed_at, input_count, success_count",
    )
    .eq("id", jobId)
    .maybeSingle()

  if (error || !job) {
    return { jobId, error: error?.message ?? "Job not found" }
  }

  const metadata = (job.metadata ?? {}) as BatchJobMetadata
  const passportIds = await resolvePassportIdsForJob(admin, job, metadata)
  const passports = passportIds.length ? await loadPassportsForExport(admin, passportIds) : null

  return {
    jobId: job.id,
    jobName: job.job_name,
    status: job.status,
    successCount: job.success_count,
    importPassportCount: metadata.import_passport_ids?.length ?? 0,
    resolvedCount: passportIds.length,
    passportIds,
    serialNumbers: (passports ?? []).map((p) => p.serial_number),
  }
}

async function main() {
  loadEnvLocalIntoProcess()
  const admin = createAdminClient()
  let jobIds = process.argv.slice(2).filter(Boolean)

  if (jobIds.length === 0) {
    const { data: jobs } = await admin
      .from("qr_batch_jobs")
      .select("id, job_name")
      .in("status", ["completed", "partial_success"])
      .order("created_at", { ascending: false })
      .limit(2)

    jobIds = (jobs ?? []).map((j) => j.id as string)
    if (jobIds.length === 0) {
      console.error("No completed batch jobs found.")
      process.exit(1)
    }
    console.log(
      "Using latest completed jobs:",
      (jobs ?? []).map((j) => `${String(j.id).slice(0, 8)}… ${j.job_name}`).join(" | "),
    )
  }

  const results: JobInspection[] = []
  for (const jobId of jobIds.slice(0, 2)) {
    results.push(await inspectJob(admin, jobId))
  }

  console.log(JSON.stringify(results, null, 2))

  if (results.some((r) => "error" in r && r.error)) {
    process.exit(1)
  }

  const resolved = results.filter((r): r is JobInspectionSuccess => !("error" in r))
  const [first, second] = resolved
  if (resolved.length === 2 && first && second && first.resolvedCount > 0 && second.resolvedCount > 0) {
    const overlap = first.passportIds.filter((id: string) => second.passportIds.includes(id))
    if (overlap.length > 0) {
      console.error("\nFAIL: Both batches resolve to overlapping passport ids:", overlap)
      process.exit(1)
    }
    console.log("\nOK: Batch exports resolve to distinct passport sets.")
    console.log(`  Batch 1 serials: ${first.serialNumbers.join(", ")}`)
    console.log(`  Batch 2 serials: ${second.serialNumbers.join(", ")}`)
  } else if (resolved.some((r) => r.resolvedCount === 0)) {
    console.error("\nWARN: One or more batches resolved zero passports — re-import may be required.")
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
