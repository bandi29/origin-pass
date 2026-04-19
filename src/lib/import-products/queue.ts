import { Queue } from "bullmq"
import IORedis from "ioredis"

export const PRODUCT_IMPORT_QUEUE = "product-import"

let redis: IORedis | null = null

function getRedis(): IORedis | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null
  if (!redis) {
    redis = new IORedis(url, { maxRetriesPerRequest: null })
  }
  return redis
}

export function hasRedisQueue(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

export async function enqueueProductImport(jobId: string): Promise<void> {
  const conn = getRedis()
  if (conn) {
    const queue = new Queue(PRODUCT_IMPORT_QUEUE, { connection: conn })
    await queue.add(
      "run",
      { jobId },
      { jobId: `import-${jobId}`, removeOnComplete: 100, removeOnFail: 50 },
    )
    return
  }
  const { processImportJob } = await import("./process-import-job")
  void processImportJob(jobId).catch((e) => {
    console.error("inline import job failed", jobId, e)
  })
}
