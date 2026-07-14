/**
 * Distributed tracing facade.
 *
 * Provides a stable API the application can use today without committing to a
 * vendor. When `@opentelemetry/api` is available at runtime the helpers create
 * real spans; otherwise they no-op so unconfigured environments stay healthy.
 *
 * Install to activate (one-time):
 *   npm install @vercel/otel @opentelemetry/api
 *   # plus the auto-instrumentation packages you want:
 *   npm install @opentelemetry/instrumentation-pg @opentelemetry/instrumentation-ioredis
 *
 * Wire-up: `instrumentation.ts` at the project root is auto-loaded by Next.js 16
 * and registers the SDK. See that file for the OTLP endpoint configuration.
 *
 * Usage:
 *   import { withSpan, addSpanAttribute } from "@/lib/tracing"
 *
 *   const verdict = await withSpan("scan.process", { passportId }, async () => {
 *     addSpanAttribute("verdict", verdict)
 *     return doWork()
 *   })
 */

type Attributes = Record<string, string | number | boolean | undefined | null>

// Lazy-loaded OpenTelemetry API handle. When the package isn't installed, the
// helpers below run their callbacks directly with no overhead beyond a flag check.
type OtelApi = typeof import("@opentelemetry/api")
let otelApi: OtelApi | null = null
let otelChecked = false

async function getOtelApi(): Promise<OtelApi | null> {
  if (otelChecked) return otelApi
  otelChecked = true
  try {
    // Dynamic import so build doesn't fail when the package is absent. The
    // import resolves only on first call to withSpan(); subsequent calls reuse
    // the cached handle.
    otelApi = (await import("@opentelemetry/api")) as OtelApi
  } catch {
    otelApi = null
  }
  return otelApi
}

function attrsToOtel(attrs: Attributes | undefined): Record<string, string | number | boolean> {
  if (!attrs) return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v
    } else {
      out[k] = String(v)
    }
  }
  return out
}

/**
 * Wrap an async unit of work with a tracing span. If OTel isn't installed, the
 * function runs unchanged. If a span errors, it is recorded and re-thrown.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
): Promise<T> {
  const api = await getOtelApi()
  if (!api) return fn()

  const tracer = api.trace.getTracer("originpass")
  return tracer.startActiveSpan(name, { attributes: attrsToOtel(attributes) }, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: api.SpanStatusCode.OK })
      return result
    } catch (err) {
      if (err instanceof Error) {
        span.recordException(err)
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: err.message })
      } else {
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: String(err) })
      }
      throw err
    } finally {
      span.end()
    }
  })
}

/**
 * Add attributes to the currently active span (if any). No-ops outside a span
 * or when OTel isn't installed.
 */
export function addSpanAttribute(key: string, value: string | number | boolean): void {
  if (!otelApi) return
  const span = otelApi.trace.getActiveSpan()
  if (!span) return
  span.setAttribute(key, value)
}

/** Add an event to the active span — useful for marking sub-phases (cache hit, DB write, etc.). */
export function addSpanEvent(name: string, attrs?: Attributes): void {
  if (!otelApi) return
  const span = otelApi.trace.getActiveSpan()
  if (!span) return
  span.addEvent(name, attrsToOtel(attrs))
}

/**
 * Returns the current trace id from the active OTel context (if any). Useful for
 * stamping log lines so traces and logs can be cross-referenced even without
 * automatic correlation in the log backend.
 */
export function getActiveTraceId(): string | null {
  if (!otelApi) return null
  const span = otelApi.trace.getActiveSpan()
  if (!span) return null
  const ctx = span.spanContext()
  return ctx.traceId || null
}
