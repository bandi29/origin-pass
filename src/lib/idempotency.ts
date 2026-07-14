/**
 * Lightweight idempotency-key middleware for POST handlers.
 *
 * Why: a network blip + automatic retry on `/api/qr/batch-generate` would otherwise
 * generate duplicate QR rows and duplicate Storage uploads; `/api/share/create`
 * would produce ghost share_event rows; `/api/scans/process` would over-count scans.
 *
 * Contract:
 *   - Client sends `Idempotency-Key: <unique-string>` header.
 *   - First request executes the handler and caches `{ status, body }` in Redis
 *     under `idem:<scope>:<key>`.
 *   - Subsequent requests with the same key replay the cached response.
 *   - Without Redis configured the helper is a no-op (returns null) so handlers
 *     stay functional in local dev.
 *
 * Scope keys (avoid cross-tenant collisions on a guessed key):
 *   - Authenticated routes: `${userId}`.
 *   - Anonymous routes: hashed client IP (via existing `hashIpForStorage`).
 */
import { getRedis } from "@/lib/redis-client"
import { hashIpForStorage } from "@/lib/ip-hash"

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 // 24 hours

type CachedResponse = {
  status: number
  headers?: Record<string, string>
  body: unknown
}

function redisKey(scope: string, key: string): string {
  return `idem:${scope}:${key}`
}

export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key") || request.headers.get("Idempotency-Key")
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Cap length to avoid Redis abuse via huge keys.
  if (trimmed.length > 200) return null
  // Reject obvious garbage; allow URL-safe characters + dashes/underscores.
  if (!/^[A-Za-z0-9_\-:.]+$/.test(trimmed)) return null
  return trimmed
}

export function deriveAnonymousScope(ip: string | null): string {
  return `anon:${hashIpForStorage(ip) ?? "unknown"}`
}

export function deriveUserScope(userId: string): string {
  return `user:${userId}`
}

/** Returns the cached response if present, else null. */
export async function getCachedIdempotentResponse(
  scope: string,
  key: string,
): Promise<Response | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get(redisKey(scope, key))
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedResponse
    return Response.json(cached.body, {
      status: cached.status,
      headers: { ...(cached.headers ?? {}), "Idempotency-Replay": "true" },
    })
  } catch (err) {
    console.warn("idempotency:get", err instanceof Error ? err.message : err)
    return null
  }
}

export async function storeIdempotentResponse(
  scope: string,
  key: string,
  payload: CachedResponse,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(redisKey(scope, key), JSON.stringify(payload), "EX", ttlSeconds)
  } catch (err) {
    console.warn("idempotency:set", err instanceof Error ? err.message : err)
  }
}

/**
 * Convenience wrapper: reads the header, replays if cached, otherwise runs the
 * handler and caches the JSON response. The handler must return a Response with
 * a JSON body for caching to occur; non-JSON responses are passed through uncached.
 *
 * Usage in a route handler:
 *
 *   const idem = readIdempotencyKey(request)
 *   if (idem) {
 *     const cached = await getCachedIdempotentResponse(scope, idem)
 *     if (cached) return cached
 *   }
 *   const response = await doWork()
 *   if (idem && response.ok) {
 *     await storeIdempotentResponse(scope, idem, { status: response.status, body })
 *   }
 *   return response
 */
