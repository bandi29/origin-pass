/**
 * Simple in-memory rate limiter for verification API.
 * For production at scale, use Redis/Upstash or similar.
 *
 * Limit: 60 requests per minute per IP.
 */

const windowMs = 60 * 1000
const maxRequests = 60

const store = new Map<string, { count: number; resetAt: number }>()

function prune() {
  const now = Date.now()
  for (const [key, val] of store.entries()) {
    if (val.resetAt < now) store.delete(key)
  }
}

export function checkRateLimit(ip: string | null): { ok: boolean; remaining: number } {
  if (!ip) return { ok: true, remaining: maxRequests }

  const now = Date.now()
  if (store.size > 10000) prune()

  const entry = store.get(ip)
  if (!entry) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: maxRequests - 1 }
  }

  if (entry.resetAt < now) {
    entry.count = 1
    entry.resetAt = now + windowMs
    return { ok: true, remaining: maxRequests - 1 }
  }

  entry.count++
  const remaining = Math.max(0, maxRequests - entry.count)
  return {
    ok: entry.count <= maxRequests,
    remaining,
  }
}
