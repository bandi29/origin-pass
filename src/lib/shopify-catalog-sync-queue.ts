/**
 * BullMQ queue for Shopify catalog syncs (split architecture).
 *
 * Serverless side: `enqueueCatalogSync` does one fast Redis round-trip and
 * returns — no loops, no Shopify calls, no DB writes. The persistent worker
 * (`src/workers/run-catalog-sync-worker.ts`) does the heavy lifting.
 *
 * Connection hygiene: one module-level IORedis connection and one Queue
 * instance per process (Vercel reuses warm lambdas, so this prevents socket
 * fatigue from per-request `new Queue()` churn). `maxRetriesPerRequest: null`
 * is a BullMQ requirement for its blocking connections.
 */

import { Queue } from "bullmq"
import IORedis from "ioredis"
import type { CatalogSyncJobPayload } from "@/lib/shopify-catalog-sync-job"

export const SHOPIFY_CATALOG_SYNC_QUEUE = "shopify-catalog-sync"

let connection: IORedis | null = null
let queue: Queue<CatalogSyncJobPayload> | null = null

/**
 * Defensive initialization: when REDIS_URL is undefined/empty, the queue simply
 * does not exist (`null`) — no connection attempt, no crash, zero infrastructure
 * dependency. The app builds and serves on Vercel with BullMQ fully dormant.
 *
 * Note: this is a lazy singleton getter rather than a top-level
 * `export const productSyncQueue = REDIS_URL ? new Queue(...) : null` because a
 * module-scope `new Queue()` would open sockets at import/build time on every
 * lambda that transitively imports this file — the getter defers that to first
 * actual use while keeping identical null-when-unconfigured semantics.
 */
export function getCatalogSyncQueue(): Queue<CatalogSyncJobPayload> | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return null
  if (!connection) {
    connection = new IORedis(url, { maxRetriesPerRequest: null })
    connection.on("error", (err) => {
      console.warn("[catalog-sync-queue] redis error:", err instanceof Error ? err.message : err)
    })
  }
  if (!queue) {
    queue = new Queue<CatalogSyncJobPayload>(SHOPIFY_CATALOG_SYNC_QUEUE, { connection })
  }
  return queue
}

/** Whether the background infrastructure is deployed (REDIS_URL configured). */
export function hasCatalogSyncQueue(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

export type EnqueueCatalogSyncResult = {
  jobId: string
  mode: "queued"
}

/**
 * Enqueue a catalog sync for `shop`, or return null when the queue infrastructure
 * is not deployed — the caller decides the inline fallback (routing lives in the
 * trigger endpoint, not here). Deterministic jobId (`catalog-sync-{shop}`) plus
 * immediate removal on completion/failure means duplicate adds are no-ops while a
 * job is waiting/active; the durable outcome lives in `sync:progress:{shop}`.
 */
export async function enqueueCatalogSync(shop: string): Promise<EnqueueCatalogSyncResult | null> {
  const q = getCatalogSyncQueue()
  if (!q) return null

  const jobId = `catalog-sync-${shop}`
  await q.add(
    "run",
    { shopDomain: shop, context: "full-catalog" },
    { jobId, removeOnComplete: true, removeOnFail: true, attempts: 1 },
  )
  return { jobId, mode: "queued" }
}
