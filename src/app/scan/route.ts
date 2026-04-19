import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { processScan } from "@/backend/modules/scans/process-scan"

type ScanBody = {
  serialId?: string
}

export async function POST(request: Request) {
  const ctx = await buildRequestContext()
  let body: ScanBody

  try {
    body = (await request.json()) as ScanBody
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const serialId = body.serialId?.trim()
  if (!serialId) return fail(ctx.traceId, "serialId is required.", 400)

  const result = await processScan({
    serialId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    city: ctx.city,
    country: ctx.country,
  })

  return ok(ctx.traceId, result)
}
