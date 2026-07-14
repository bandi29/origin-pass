import { after } from "next/server"
import { processPassportImportJob } from "@/lib/passport-batch-import-server"

/**
 * Kick off background processing for a queued passport manifest job.
 * Uses Next.js `after()` so the HTTP response returns while work continues.
 */
export function enqueuePassportImportProcessing(jobId: string): void {
  after(async () => {
    try {
      await processPassportImportJob(jobId)
    } catch (err) {
      console.warn(
        "[passport-batch-import] background processing failed:",
        err instanceof Error ? err.message : err,
      )
    }
  })
}
