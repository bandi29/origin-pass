/**
 * Shopify catalog sync worker — runs on a persistent container (Render/Railway),
 * NOT on Vercel. Consumes the `shopify-catalog-sync` queue and executes the
 * long-running export/parse/upsert pipeline without serverless time limits.
 *
 * Run alongside the Next.js app when REDIS_URL is set:
 *   REDIS_URL=rediss://... npm run worker:catalog-sync
 *
 * Requires the same env as the app server: REDIS_URL, SUPABASE_* (service role),
 * since it re-reads the merchant token from Supabase (never from the payload).
 */
import { Worker } from "bullmq"
import IORedis from "ioredis"
import { SHOPIFY_CATALOG_SYNC_QUEUE } from "@/lib/shopify-catalog-sync-queue"
import { processCatalogSyncJob, type CatalogSyncJobPayload } from "@/lib/shopify-catalog-sync-job"
import { isValidShopDomain } from "@/lib/shopify"

const url = process.env.REDIS_URL?.trim()
if (!url) {
  console.error("REDIS_URL is required for the catalog sync worker.")
  process.exit(1)
}

// Single shared connection for the worker process (BullMQ blocking client).
const connection = new IORedis(url, { maxRetriesPerRequest: null })
connection.on("error", (err) => {
  console.warn("[catalog-sync-worker] redis error:", err instanceof Error ? err.message : err)
})

const worker = new Worker<CatalogSyncJobPayload>(
  SHOPIFY_CATALOG_SYNC_QUEUE,
  async (job) => {
    const shop = job.data?.shopDomain
    if (!isValidShopDomain(shop)) throw new Error(`Invalid shopDomain in job ${job.id}`)

    const outcome = await processCatalogSyncJob(shop)
    // The engine already published the terminal state to sync:progress:{shop};
    // returning the outcome makes it visible in BullMQ tooling too.
    return outcome
  },
  {
    connection,
    // Catalog syncs are heavy (up to 20k+ rows); one at a time per worker keeps
    // memory bounded and the Supabase pool healthy. Scale via worker replicas.
    concurrency: 1,
  },
)

worker.on("completed", (job) => {
  console.log("[catalog-sync-worker] completed", job.id)
})

worker.on("failed", (job, err) => {
  console.error("[catalog-sync-worker] job failed", job?.id, err)
})

// Graceful shutdown: finish/settle the in-flight job before the container dies,
// then release Redis sockets so nothing is left half-committed.
async function shutdown(signal: string) {
  console.log(`[catalog-sync-worker] ${signal} received — closing…`)
  try {
    await worker.close()
  } finally {
    connection.disconnect()
    process.exit(0)
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))

console.log("Catalog sync worker listening on queue", SHOPIFY_CATALOG_SYNC_QUEUE)
