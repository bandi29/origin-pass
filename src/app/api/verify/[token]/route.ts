import { buildRequestContext } from "@/backend/middleware/request-context"
import { verifyAndGetResponse } from "@/backend/modules/verification/service"
import { ok, fail } from "@/backend/api/gateway"
import { isValidVerifyToken } from "@/lib/verify-token"
import { isValidSerialId } from "@/lib/security"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const ctx = await buildRequestContext()

  const { ok: allowed, remaining } = checkRateLimit(ctx.ipAddress)
  if (!allowed) {
    return fail(ctx.traceId, "Too many requests. Try again later.", 429)
  }

  const { token } = await params
  const trimmed = token?.trim()
  if (!trimmed) {
    return fail(ctx.traceId, "Token is required.", 400)
  }

  const isValid =
    isValidVerifyToken(trimmed) || isValidSerialId(trimmed)
  if (!isValid) {
    return fail(ctx.traceId, "Invalid token format.", 400)
  }

  try {
    const response = await verifyAndGetResponse(trimmed, {
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      city: ctx.city,
      country: ctx.country,
    })

    const res = ok(ctx.traceId, response)
    res.headers.set("X-RateLimit-Remaining", String(remaining))
    return res
  } catch (err) {
    console.error("Verify API error:", err)
    return fail(
      ctx.traceId,
      err instanceof Error ? err.message : "Verification failed.",
      500
    )
  }
}
