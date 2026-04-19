type Entry = { resetAt: number; count: number }

const buckets = new Map<string, Entry>()

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now()
  let e = buckets.get(key)
  if (!e || now >= e.resetAt) {
    e = { resetAt: now + windowMs, count: 0 }
    buckets.set(key, e)
  }
  if (e.count >= max) {
    return { ok: false, retryAfterMs: Math.max(0, e.resetAt - now) }
  }
  e.count++
  return { ok: true }
}
