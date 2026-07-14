import IORedis from "ioredis"

let redis: IORedis | null = null
let warnedNoUrl = false

/**
 * Shared Redis client for rate limiting, caching, and queue access. Returns null
 * when REDIS_URL is not configured (development mode without Redis); callers
 * must handle the null case (typically by falling back to in-memory state).
 */
export function getRedis(): IORedis | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    if (!warnedNoUrl && process.env.NODE_ENV === "production") {
      console.warn(
        "REDIS_URL is not set in production; rate limiting falls back to in-memory and will be bypassed across serverless instances.",
      )
      warnedNoUrl = true
    }
    return null
  }
  if (!redis) {
    redis = new IORedis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    redis.on("error", (err) => {
      console.warn("Redis error:", err instanceof Error ? err.message : err)
    })
  }
  return redis
}

export function hasRedis(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}
