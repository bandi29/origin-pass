/**
 * Standalone QR-generation worker.
 *
 * Run with: `tsx src/workers/run-qr-generation-worker.ts`
 * Scale concurrency independently via WORKER_QR_GENERATION_CONCURRENCY.
 */
import { Worker } from "bullmq"
import IORedis from "ioredis"

import { QR_GENERATION_QUEUE, type QrGenerationJob } from "@/lib/qr-generation/queue"
import { executeQrGenerationBatch } from "@/lib/qr-generation/process"
import { logger } from "@/lib/logger"

const REDIS_URL = process.env.REDIS_URL?.trim()
if (!REDIS_URL) {
  throw new Error("REDIS_URL is required to run the qr-generation worker")
}

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

const concurrency = Number(process.env.WORKER_QR_GENERATION_BATCH_CONCURRENCY ?? "2") || 2

const worker = new Worker<QrGenerationJob>(
  QR_GENERATION_QUEUE,
  async (job) => {
    await executeQrGenerationBatch(job.data)
  },
  { connection, concurrency },
)

worker.on("failed", (job, err) => {
  logger.error(
    {
      scope: "qr-generation.worker",
      jobId: job?.id,
      attempts: job?.attemptsMade,
      errMessage: err?.message,
    },
    "qr-generation.job.failed",
  )
})

worker.on("ready", () => {
  logger.info({ scope: "qr-generation.worker", concurrency }, "qr-generation.worker.ready")
})

process.on("SIGTERM", async () => {
  logger.info({ scope: "qr-generation.worker" }, "qr-generation.worker.shutdown")
  await worker.close()
  await connection.quit()
  process.exit(0)
})
