/**
 * Scan-pipeline queue: offloads the write-heavy half of QR-scan processing to a
 * background worker so the public verify response returns in ~50 ms instead of
 * 300–800 ms p95.
 *
 * Payload contract: fully self-contained — the worker re-fetches nothing it can
 * receive in the message. Keeps the queue independent of caches and short-lived
 * request state.
 */
import { Queue } from "bullmq"
import IORedis from "ioredis"

export const SCAN_PIPELINE_QUEUE = "scan-pipeline"

export type ScanPipelineJob = {
  passport: {
    id: string
    productId: string | null
    organizationId: string | null
    serialNumber: string | null
  }
  scan: {
    timestamp: string
    ipAddress: string | null
    userAgent: string | null
    city: string | null
    country: string | null
    region: string | null
    locationLabel: string | null
    scanSource: string
  }
  fraud: {
    riskScore: number
    status: "valid" | "suspicious" | "fraud"
    reason: string
    totalScanCount: number
  }
  serialId: string
  verdict: "verified" | "suspicious" | "fraud"
  traceId?: string
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

export function hasScanPipelineQueue(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

let queueSingleton: Queue<ScanPipelineJob> | null = null

function getQueue(): Queue<ScanPipelineJob> | null {
  const conn = getRedis()
  if (!conn) return null
  if (!queueSingleton) {
    queueSingleton = new Queue<ScanPipelineJob>(SCAN_PIPELINE_QUEUE, { connection: conn })
  }
  return queueSingleton
}

/**
 * Enqueue a scan-write job. When Redis is not configured, falls back to running
 * the pipeline inline (fire-and-forget) — fine for local dev, but every production
 * deployment MUST configure REDIS_URL.
 */
export async function enqueueScanPipeline(job: ScanPipelineJob): Promise<void> {
  const queue = getQueue()
  if (queue) {
    await queue.add("write", job, {
      removeOnComplete: 500,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
    })
    return
  }

  // Dev fallback: execute inline, don't block the caller.
  if (process.env.NODE_ENV === "production") {
    console.warn("[scan-pipeline] REDIS_URL not configured; running scan-pipeline INLINE in production is a scalability foot-gun")
  }
  const { executeScanWritePipeline } = await import("@/lib/scan-pipeline/process")
  void executeScanWritePipeline(job).catch((err) => {
    console.warn("[scan-pipeline] inline execution failed:", err instanceof Error ? err.message : err)
  })
}
