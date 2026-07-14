/**
 * QR-generation queue: takes the multi-minute batch QR build off the HTTP request
 * path so the API returns a job id immediately and the worker processes labels
 * asynchronously. The route returns "queued" / "processing"; the UI polls
 * `qr_batch_jobs.status` or subscribes via Supabase realtime.
 */
import { Queue } from "bullmq"
import IORedis from "ioredis"

export const QR_GENERATION_QUEUE = "qr-generation"

export type QrGenerationJob = {
  batchJobId: string
  organizationId: string | null
  actorUserId: string
  productIds: string[]
}

let redis: IORedis | null = null

function getRedis(): IORedis | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null
  if (!redis) {
    redis = new IORedis(url, { maxRetriesPerRequest: null })
  }
  return redis
}

export function hasQrGenerationQueue(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

let queueSingleton: Queue<QrGenerationJob> | null = null

function getQueue(): Queue<QrGenerationJob> | null {
  const conn = getRedis()
  if (!conn) return null
  if (!queueSingleton) {
    queueSingleton = new Queue<QrGenerationJob>(QR_GENERATION_QUEUE, { connection: conn })
  }
  return queueSingleton
}

export async function enqueueQrGeneration(job: QrGenerationJob): Promise<void> {
  const queue = getQueue()
  if (queue) {
    await queue.add("generate", job, {
      jobId: `qr-${job.batchJobId}`,
      removeOnComplete: 200,
      removeOnFail: 50,
      attempts: 2,
      backoff: { type: "exponential", delay: 5_000 },
    })
    return
  }

  // Dev fallback: run inline (fire-and-forget) so endpoints don't break when no Redis.
  if (process.env.NODE_ENV === "production") {
    console.warn("[qr-generation] REDIS_URL not configured — running batch INLINE in production is unsafe")
  }
  const { executeQrGenerationBatch } = await import("@/lib/qr-generation/process")
  void executeQrGenerationBatch(job).catch((err) => {
    console.warn("[qr-generation] inline execution failed:", err instanceof Error ? err.message : err)
  })
}
