/**
 * Shopify catalog sync progress, keyed by shop domain.
 *
 * Two layers:
 *  - In-memory map (below): same-process cache + the dev fallback when REDIS_URL
 *    is unset (inline sync runs in the same process, so memory is authoritative).
 *  - Redis (the `*Shared*` async functions): the source of truth in the split
 *    architecture, where the Vercel instance that enqueues, the instance that
 *    answers status polls, and the persistent worker running the job are all
 *    DIFFERENT processes. Key convention: `sync:progress:{shopDomain}`.
 */

import { getRedis } from "@/lib/redis-client"

export type ShopifySyncProgressStatus = "idle" | "running" | "done" | "error"

export type ShopifySyncProgress = {
  status: ShopifySyncProgressStatus
  processed: number
  total: number | null
  percent: number
  message: string | null
  ok: boolean | null
  updatedAt: number
}

const STALE_MS = 10 * 60 * 1000

type ProgressStore = Map<string, ShopifySyncProgress>

function getStore(): ProgressStore {
  const g = globalThis as Record<string, unknown>
  const key = "__originpass_shopify_sync_progress__"
  let store = g[key] as ProgressStore | undefined
  if (!store) {
    store = new Map()
    g[key] = store
  }
  return store
}

/** Percent complete: 0 when total unknown, 100 when total is 0 (empty catalog). */
export function computeSyncProgressPercent(processed: number, total: number | null): number {
  if (total == null || total <= 0) {
    return total === 0 ? 100 : 0
  }
  return Math.min(100, Math.round((processed / total) * 100))
}

function pruneStale(store: ProgressStore) {
  const cutoff = Date.now() - STALE_MS
  for (const [shop, entry] of store) {
    if (entry.updatedAt < cutoff) store.delete(shop)
  }
}

export function getShopifySyncProgressState(shop: string): ShopifySyncProgress {
  const store = getStore()
  pruneStale(store)
  return (
    store.get(shop) ?? {
      status: "idle",
      processed: 0,
      total: null,
      percent: 0,
      message: null,
      ok: null,
      updatedAt: Date.now(),
    }
  )
}

export function beginShopifySyncProgress(shop: string): boolean {
  const store = getStore()
  const current = store.get(shop)
  if (current?.status === "running") return false

  store.set(shop, {
    status: "running",
    processed: 0,
    total: null,
    percent: 0,
    message: null,
    ok: null,
    updatedAt: Date.now(),
  })
  return true
}

export function updateShopifySyncProgress(
  shop: string,
  patch: Partial<Pick<ShopifySyncProgress, "processed" | "total" | "message">>,
): void {
  const store = getStore()
  const current = store.get(shop)
  if (!current || current.status !== "running") return

  const processed = patch.processed ?? current.processed
  const total = patch.total !== undefined ? patch.total : current.total
  store.set(shop, {
    ...current,
    processed,
    total,
    percent: computeSyncProgressPercent(processed, total),
    message: patch.message ?? current.message,
    updatedAt: Date.now(),
  })
}

export function finishShopifySyncProgress(
  shop: string,
  result: { ok: boolean; message: string; processed: number; total: number | null },
): void {
  const store = getStore()
  store.set(shop, {
    status: result.ok ? "done" : "error",
    processed: result.processed,
    total: result.total,
    percent: computeSyncProgressPercent(result.processed, result.total),
    message: result.message,
    ok: result.ok,
    updatedAt: Date.now(),
  })
}

export function clearShopifySyncProgress(shop: string): void {
  getStore().delete(shop)
}

// ---------------------------------------------------------------------------
// Redis-backed shared layer (split architecture: API instances + worker)
// ---------------------------------------------------------------------------

const REDIS_KEY_PREFIX = "sync:progress:"
/** Progress entries expire after the same staleness window as the memory map. */
const REDIS_TTL_SECONDS = Math.floor(STALE_MS / 1000)

function redisProgressKey(shop: string): string {
  return `${REDIS_KEY_PREFIX}${shop}`
}

function isProgressShape(value: unknown): value is ShopifySyncProgress {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return typeof v.status === "string" && typeof v.processed === "number" && typeof v.updatedAt === "number"
}

/** Mirror this process's in-memory state for `shop` out to Redis (best-effort). */
async function mirrorProgressToRedis(shop: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    const state = getShopifySyncProgressState(shop)
    await redis.set(redisProgressKey(shop), JSON.stringify(state), "EX", REDIS_TTL_SECONDS)
  } catch (err) {
    // Progress mirroring must never take down the sync itself.
    console.warn("[sync-progress] redis mirror failed:", err instanceof Error ? err.message : err)
  }
}

/** Read progress: Redis first (cross-instance truth), memory fallback (dev/inline). */
export async function readSharedSyncProgress(shop: string): Promise<ShopifySyncProgress> {
  const redis = getRedis()
  if (redis) {
    try {
      const raw = await redis.get(redisProgressKey(shop))
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (isProgressShape(parsed)) return parsed
      }
    } catch (err) {
      console.warn("[sync-progress] redis read failed:", err instanceof Error ? err.message : err)
    }
  }
  return getShopifySyncProgressState(shop)
}

/**
 * Begin a run with a cross-instance duplicate guard: if Redis (or local memory)
 * shows a fresh `running` entry, refuse. Seeds both layers on success.
 */
export async function beginSharedSyncProgress(shop: string, message: string | null = null): Promise<boolean> {
  const current = await readSharedSyncProgress(shop)
  if (current.status === "running" && Date.now() - current.updatedAt < STALE_MS) return false

  // Reset local memory (it may hold a stale/terminal entry) and seed running state.
  clearShopifySyncProgress(shop)
  beginShopifySyncProgress(shop)
  if (message) updateShopifySyncProgress(shop, { message })
  await mirrorProgressToRedis(shop)
  return true
}

/** Update counters/message in memory, then push to Redis so pollers see it live. */
export async function updateSharedSyncProgress(
  shop: string,
  patch: Partial<Pick<ShopifySyncProgress, "processed" | "total" | "message">>,
): Promise<void> {
  updateShopifySyncProgress(shop, patch)
  await mirrorProgressToRedis(shop)
}

/** Record the terminal state in both layers. */
export async function finishSharedSyncProgress(
  shop: string,
  result: { ok: boolean; message: string; processed: number; total: number | null },
): Promise<void> {
  finishShopifySyncProgress(shop, result)
  await mirrorProgressToRedis(shop)
}
