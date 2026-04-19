import { headers } from "next/headers"

export type RequestContext = {
  traceId: string
  ipAddress: string | null
  userAgent: string | null
  country: string | null
  city: string | null
}

export async function buildRequestContext(): Promise<RequestContext> {
  const h = await headers()
  const forwardedFor = h.get("x-forwarded-for")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null

  return {
    traceId: h.get("x-request-id") || crypto.randomUUID(),
    ipAddress,
    userAgent: h.get("user-agent"),
    country: h.get("x-vercel-ip-country") || h.get("cf-ipcountry"),
    city: h.get("x-vercel-ip-city") || null,
  }
}
