/**
 * Redis-backed sliding rate limiter with in-memory fallback for development.
 *
 * Default limit: 60 requests per minute per IP.
 *
 * Production: when REDIS_URL is set, uses Redis INCR + EXPIRE so the limit is shared
 * across serverless instances.
 *
 * Development / no Redis: falls back to an in-memory Map keyed by IP. NOTE: the
 * in-memory limiter is per-process — it is trivially bypassed in serverless
 * environments by waiting for a cold start or hitting a different instance.
 */
import { getRedis } from "@/lib/redis-client"

const DEFAULT_WINDOW_MS = 60 * 1000
const DEFAULT_MAX = 60

type Result = { ok: boolean; remaining: number }

const memoryStore = new Map<string, { count: number; resetAt: number }>()

function pruneMemory(now: number) {
  for (const [key, val] of memoryStore.entries()) {
    if (val.resetAt < now) memoryStore.delete(key)
  }
}

function checkInMemory(key: string, max: number, windowMs: number): Result {
  const now = Date.now()
  if (memoryStore.size > 10000) pruneMemory(now)

  const entry = memoryStore.get(key)
  if (!entry) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1 }
  }
  if (entry.resetAt < now) {
    entry.count = 1
    entry.resetAt = now + windowMs
    return { ok: true, remaining: max - 1 }
  }
  entry.count++
  const remaining = Math.max(0, max - entry.count)
  return { ok: entry.count <= max, remaining }
}

async function checkInRedis(key: string, max: number, windowMs: number): Promise<Result> {
  const redis = getRedis()
  if (!redis) return checkInMemory(key, max, windowMs)

  const redisKey = `rl:${key}`
  try {
    const pipeline = redis.multi()
    pipeline.incr(redisKey)
    pipeline.pexpire(redisKey, windowMs, "NX")
    const replies = (await pipeline.exec()) as [Error | null, number][] | null
    if (!replies) return checkInMemory(key, max, windowMs)
    const count = Number(replies[0]?.[1] ?? 0)
    const remaining = Math.max(0, max - count)
    return { ok: count <= max, remaining }
  } catch (err) {
    console.warn("Redis rate limit error, falling back to memory:", err instanceof Error ? err.message : err)
    return checkInMemory(key, max, windowMs)
  }
}

/**
 * Synchronous check kept for backwards compatibility with existing callers.
 * Uses the in-memory store only; prefer `checkRateLimitAsync` for Redis-backed
 * limits that persist across serverless instances.
 */
export function checkRateLimit(ip: string | null, max = DEFAULT_MAX, windowMs = DEFAULT_WINDOW_MS): Result {
  if (!ip) return { ok: true, remaining: max }
  return checkInMemory(ip, max, windowMs)
}

/**
 * Async variant that prefers Redis when available. Recommended for all new code
 * and for any endpoint that may run on serverless / multiple instances.
 */
export async function checkRateLimitAsync(
  ip: string | null,
  max = DEFAULT_MAX,
  windowMs = DEFAULT_WINDOW_MS,
): Promise<Result> {
  if (!ip) return { ok: true, remaining: max }
  return checkInRedis(ip, max, windowMs)
}
