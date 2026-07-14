import { headers } from "next/headers"
import { decodeGeoHeader, devFallbackGeo } from "@/lib/geo-headers"
import { getClientIp } from "@/lib/client-ip"
import { setLogContext } from "@/lib/logger"

export type RequestContext = {
  traceId: string
  ipAddress: string | null
  userAgent: string | null
  country: string | null
  city: string | null
}

export async function buildRequestContext(): Promise<RequestContext> {
  const h = await headers()
  const ipAddress = getClientIp(h)
  const country =
    h.get("x-vercel-ip-country")?.trim() ||
    h.get("cf-ipcountry")?.trim() ||
    h.get("cloudflare-ip-country")?.trim() ||
    null
  const city = decodeGeoHeader(h.get("x-vercel-ip-city") || h.get("cf-ipcity"))
  const dev = devFallbackGeo()

  const ctx: RequestContext = {
    traceId: h.get("x-request-id") || crypto.randomUUID(),
    ipAddress,
    userAgent: h.get("user-agent"),
    country: country || dev.country,
    city: city || dev.city,
  }

  // Propagate traceId to the structured logger so any downstream logger.* call
  // within this request automatically carries the correlation ID. Best-effort —
  // outside an AsyncLocalStorage scope this is a no-op.
  setLogContext({ traceId: ctx.traceId })

  return ctx
}
