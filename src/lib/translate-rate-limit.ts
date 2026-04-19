/**
 * Per-IP rate limit for anonymous passport translation (OpenAI cost control).
 */

const windowMs = 60 * 60 * 1000
const maxPerWindow = 8

const store = new Map<string, { count: number; resetAt: number }>()

export function checkTranslateRateLimit(ipHash: string | null): { ok: boolean } {
  if (!ipHash) return { ok: true }

  const now = Date.now()
  const entry = store.get(ipHash)
  if (!entry || entry.resetAt < now) {
    store.set(ipHash, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  entry.count++
  return { ok: entry.count <= maxPerWindow }
}
