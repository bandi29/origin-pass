/**
 * Input-hash cache for expensive AI calls.
 *
 * Motivation: AI provider calls cost real money per request. Identical inputs
 * produce semantically identical outputs (modulo temperature), so we cache by a
 * stable hash of the relevant input fields. Repeated regenerations during draft
 * cycles, A/B comparisons, dashboard polling, and re-imports all short-circuit
 * to a Redis hit at <1 ms cost.
 *
 * Design notes:
 *   - Cache keys are namespaced per call type (`ai:story:v1:<hash>`). Bumping the
 *     version invalidates the cache when prompts or models change behaviour.
 *   - SHA-256 hashes inputs canonicalised by `stableStringify` so key order and
 *     whitespace differences don't fragment the cache.
 *   - Falls back to a no-op when REDIS_URL is missing (dev). Operationally safe
 *     because cached and uncached responses are functionally equivalent.
 *   - TTL is per-namespace because some artefacts (translations) are forever
 *     stable while others (stories) may be regenerated on prompt iteration.
 */
import { createHash } from "node:crypto"
import { getRedis } from "@/lib/redis-client"
import { logger } from "@/lib/logger"

export type AiCacheNamespace =
  | "story:v1"
  | "translate:v1"
  | "photo-passport:v1"

/** Default TTLs in seconds. Override per-call if needed. */
const DEFAULT_TTL_SECONDS: Record<AiCacheNamespace, number> = {
  "story:v1": 60 * 60 * 24 * 30, // 30 days
  "translate:v1": 60 * 60 * 24 * 90, // 90 days
  "photo-passport:v1": 60 * 60 * 24 * 7, // 7 days
}

function stableStringify(value: unknown): string {
  // Deterministic JSON: sort object keys at every depth so prompt-input objects
  // hash consistently regardless of property order.
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]"
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}"
}

export function hashAiInput(value: unknown): string {
  const canonical = stableStringify(value)
  return createHash("sha256").update(canonical).digest("hex")
}

function redisKey(namespace: AiCacheNamespace, hash: string): string {
  return `ai:${namespace}:${hash}`
}

export async function readAiCache<T>(
  namespace: AiCacheNamespace,
  hash: string,
): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const raw = await redis.get(redisKey(namespace, hash))
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (err) {
    logger.warn(
      { scope: "ai-cache", namespace, errMessage: err instanceof Error ? err.message : String(err) },
      "ai-cache.read.failed",
    )
    return null
  }
}

export async function writeAiCache<T>(
  namespace: AiCacheNamespace,
  hash: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  const ttl = ttlSeconds ?? DEFAULT_TTL_SECONDS[namespace]
  try {
    await redis.set(redisKey(namespace, hash), JSON.stringify(value), "EX", ttl)
  } catch (err) {
    logger.warn(
      { scope: "ai-cache", namespace, errMessage: err instanceof Error ? err.message : String(err) },
      "ai-cache.write.failed",
    )
  }
}

/**
 * Convenience wrapper: returns cached value if present, else runs `compute()` and
 * caches the result. `compute()` is only invoked on a miss, so callers may put
 * the actual AI call inside the closure without conditional logic at every site.
 */
export async function rememberAi<T>(
  namespace: AiCacheNamespace,
  input: unknown,
  compute: () => Promise<T>,
  options: { ttlSeconds?: number; skipCache?: boolean } = {},
): Promise<{ value: T; hit: boolean; hash: string }> {
  const hash = hashAiInput(input)
  if (!options.skipCache) {
    const cached = await readAiCache<T>(namespace, hash)
    if (cached !== null) {
      logger.info({ scope: "ai-cache", namespace, hash }, "ai-cache.hit")
      return { value: cached, hit: true, hash }
    }
  }
  const value = await compute()
  await writeAiCache(namespace, hash, value, options.ttlSeconds)
  logger.info({ scope: "ai-cache", namespace, hash }, "ai-cache.miss")
  return { value, hit: false, hash }
}
