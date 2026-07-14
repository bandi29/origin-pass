/**
 * Next.js instrumentation hook — auto-loaded on cold-start in Node and Edge
 * runtimes. Initialises OpenTelemetry once per process.
 *
 * Activate by installing the dependencies:
 *   npm install @vercel/otel @opentelemetry/api
 *
 * Then set in production:
 *   OTEL_EXPORTER_OTLP_ENDPOINT=https://<backend>.grafana.net/otlp
 *   OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <token>"
 *   OTEL_SERVICE_NAME=originpass-web
 *
 * Backends: Grafana Cloud / Honeycomb / Datadog / Tempo / SigNoz all speak OTLP.
 *
 * If `@vercel/otel` is not installed, this file is a no-op — useful for local dev
 * where you don't want a tracing backend running.
 */

export async function register(): Promise<void> {
  // Skip in Edge runtime — @vercel/otel is Node-only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Opt out via env when you want to disable instrumentation entirely.
  if (process.env.OTEL_DISABLED === "true") return

  try {
    // Dynamic import: if the dep isn't installed the catch swallows the error
    // and the app starts unaffected.
    const { registerOTel } = (await import(
      "@vercel/otel"
    )) as typeof import("@vercel/otel")

    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME ?? "originpass-web",
      // Defaults to the OTLP HTTP exporter on $OTEL_EXPORTER_OTLP_ENDPOINT.
      // @vercel/otel picks up the standard OTEL_* env vars automatically.
    })
  } catch (err) {
    // Most common cause: @vercel/otel not installed. That is fine — leave the
    // app uninstrumented in dev rather than crash.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[instrumentation] OpenTelemetry not initialised:",
        err instanceof Error ? err.message : err,
      )
    }
  }
}
