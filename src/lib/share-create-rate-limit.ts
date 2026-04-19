/**
 * Limit POST /api/share/create per IP (abuse prevention).
 */

const windowMs = 15 * 60 * 1000
const maxPerWindow = 40

const store = new Map<string, { count: number; resetAt: number }>()

function prune() {
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (v.resetAt < now) store.delete(k)
  }
}

export function checkShareCreateRateLimit(ip: string | null): { ok: boolean } {
  const key = ip?.trim() || "unknown"
  const now = Date.now()
  if (store.size > 50000) prune()

  const entry = store.get(key)
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  entry.count++
  return { ok: entry.count <= maxPerWindow }
}
