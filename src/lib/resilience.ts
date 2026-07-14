/**
 * Resilience primitives for upstream API calls (OpenAI, Gemini, Paddle, Resend, ...).
 *
 * Provides:
 *   - withTimeout: cancel an async call after N ms via AbortController.
 *   - withRetry: exponential-backoff retry, retries on transient errors only.
 *   - createCircuitBreaker: per-upstream half-open breaker so a degraded provider
 *     fails fast for the next N seconds instead of timing out every request.
 *
 * Usage:
 *   const breaker = getBreaker("openai")
 *   const result = await breaker.exec(() =>
 *     withRetry(() => withTimeout((signal) => sdk.chat.completions.create({...}, { signal }), 10_000))
 *   )
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Upstream call timed out after ${ms}ms`)
    this.name = "TimeoutError"
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit '${name}' is open — upstream unavailable`)
    this.name = "CircuitOpenError"
  }
}

/**
 * Runs `fn` with an AbortSignal that fires after `ms` milliseconds. The signal is
 * passed to `fn` so SDKs that accept `{ signal }` (OpenAI, fetch, etc.) can abort
 * the underlying request instead of merely abandoning the promise.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fn(controller.signal)
  } catch (err) {
    if (controller.signal.aborted) throw new TimeoutError(ms)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  // Network-ish and 5xx-ish signals that are safe to retry. Do NOT retry 4xx —
  // they are user errors and will fail identically.
  if (msg.includes("etimedout") || msg.includes("econnreset") || msg.includes("enotfound")) return true
  if (msg.includes("network") || msg.includes("fetch failed")) return true
  // OpenAI SDK exposes `.status` on its errors.
  const status = (err as { status?: number })?.status
  if (typeof status === "number") {
    if (status === 429) return true // rate-limited
    if (status >= 500 && status < 600) return true
    return false
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; maxDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3
  const base = opts.baseDelayMs ?? 250
  const cap = opts.maxDelayMs ?? 3000

  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === attempts - 1 || !isRetryableError(err)) throw err
      const delay = Math.min(cap, base * 2 ** i) + Math.floor(Math.random() * base)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

type BreakerState = "closed" | "open" | "half-open"

interface BreakerOptions {
  failureThreshold?: number
  cooldownMs?: number
  successThreshold?: number
}

class CircuitBreaker {
  private state: BreakerState = "closed"
  private failures = 0
  private successes = 0
  private openedAt = 0
  constructor(
    private readonly name: string,
    private readonly opts: Required<BreakerOptions>,
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.opts.cooldownMs) {
        this.state = "half-open"
        this.successes = 0
      } else {
        throw new CircuitOpenError(this.name)
      }
    }
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    if (this.state === "half-open") {
      this.successes += 1
      if (this.successes >= this.opts.successThreshold) {
        this.state = "closed"
        this.failures = 0
      }
      return
    }
    this.failures = 0
  }

  private onFailure() {
    this.failures += 1
    if (this.state === "half-open" || this.failures >= this.opts.failureThreshold) {
      this.state = "open"
      this.openedAt = Date.now()
    }
  }
}

const breakers = new Map<string, CircuitBreaker>()

export function getBreaker(
  name: string,
  options: BreakerOptions = {},
): CircuitBreaker {
  const existing = breakers.get(name)
  if (existing) return existing
  const breaker = new CircuitBreaker(name, {
    failureThreshold: options.failureThreshold ?? 5,
    cooldownMs: options.cooldownMs ?? 30_000,
    successThreshold: options.successThreshold ?? 2,
  })
  breakers.set(name, breaker)
  return breaker
}

/**
 * Convenience wrapper: timeout + retry + circuit breaker, in that nesting order,
 * wrapped in a tracing span so upstream latency + retries are observable.
 * - Timeout protects each attempt.
 * - Retry handles transient failures.
 * - Breaker short-circuits to fail-fast after sustained provider trouble.
 */
export async function callUpstream<T>(
  upstream: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options: {
    timeoutMs?: number
    attempts?: number
    breaker?: BreakerOptions
  } = {},
): Promise<T> {
  const { withSpan } = await import("@/lib/tracing")
  const breaker = getBreaker(upstream, options.breaker)
  return withSpan(
    "upstream.call",
    { upstream, attempts: options.attempts ?? 3, timeoutMs: options.timeoutMs ?? 10_000 },
    () =>
      breaker.exec(() =>
        withRetry(() => withTimeout(fn, options.timeoutMs ?? 10_000), {
          attempts: options.attempts ?? 3,
        }),
      ),
  )
}
