/**
 * Run alongside the Next.js app when REDIS_URL is set:
 *   REDIS_URL=redis://localhost:6379 npm run worker:import
 */
import { Worker } from "bullmq"
import IORedis from "ioredis"
import { PRODUCT_IMPORT_QUEUE } from "@/lib/import-products/queue"
import { processImportJob } from "@/lib/import-products/process-import-job"

const url = process.env.REDIS_URL?.trim()
if (!url) {
  console.error("REDIS_URL is required for the import worker.")
  process.exit(1)
}

const connection = new IORedis(url, { maxRetriesPerRequest: null })

const worker = new Worker<{ jobId: string }>(
  PRODUCT_IMPORT_QUEUE,
  async (job) => {
    const id = job.data?.jobId
    if (!id) throw new Error("Missing jobId")
    await processImportJob(id)
  },
  { connection, concurrency: 2 },
)

worker.on("failed", (job, err) => {
  console.error("import worker job failed", job?.id, err)
})

worker.on("completed", (job) => {
  console.log("import worker completed", job.id)
})

console.log("Product import worker listening on queue", PRODUCT_IMPORT_QUEUE)
