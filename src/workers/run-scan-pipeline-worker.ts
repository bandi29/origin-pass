/**
 * Standalone scan-pipeline worker.
 *
 * Run with: `tsx src/workers/run-scan-pipeline-worker.ts`
 * In production, run as its own long-lived process (Fly machine / K8s deployment)
 * scaled independently from the web tier. Concurrency is env-driven so capacity
 * can be tuned per environment without a code change.
 */
import { Worker } from "bullmq"
import IORedis from "ioredis"

import { SCAN_PIPELINE_QUEUE, type ScanPipelineJob } from "@/lib/scan-pipeline/queue"
import { executeScanWritePipeline } from "@/lib/scan-pipeline/process"
import { logger } from "@/lib/logger"

const REDIS_URL = process.env.REDIS_URL?.trim()
if (!REDIS_URL) {
  throw new Error("REDIS_URL is required to run the scan-pipeline worker")
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

const concurrency = Number(process.env.WORKER_SCAN_PIPELINE_CONCURRENCY ?? "8") || 8

const worker = new Worker<ScanPipelineJob>(
  SCAN_PIPELINE_QUEUE,
  async (job) => {
    await executeScanWritePipeline(job.data)
  },
  { connection, concurrency },
)

worker.on("failed", (job, err) => {
  logger.error(
    {
      scope: "scan-pipeline.worker",
      jobId: job?.id,
      attempts: job?.attemptsMade,
      errMessage: err?.message,
    },
    "scan-pipeline.job.failed",
  )
})

worker.on("ready", () => {
  logger.info({ scope: "scan-pipeline.worker", concurrency }, "scan-pipeline.worker.ready")
})

process.on("SIGTERM", async () => {
  logger.info({ scope: "scan-pipeline.worker" }, "scan-pipeline.worker.shutdown")
  await worker.close()
  await connection.quit()
  process.exit(0)
})
