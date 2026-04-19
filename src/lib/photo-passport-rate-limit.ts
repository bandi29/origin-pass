/** In-memory rate limit for AI photo extraction (per server instance). */
const buckets = new Map<string, number[]>()

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 24

export function checkPhotoPassportRateLimit(userId: string): { ok: boolean } {
  const now = Date.now()
  const arr = buckets.get(userId) ?? []
  const fresh = arr.filter((t) => now - t < WINDOW_MS)
  if (fresh.length >= MAX_PER_WINDOW) {
    return { ok: false }
  }
  fresh.push(now)
  buckets.set(userId, fresh)
  return { ok: true }
}
