import { claimOwnership } from "@/backend/modules/ownership/service"
import { ok, fail } from "@/backend/api/gateway"
import { buildRequestContext } from "@/backend/middleware/request-context"

export const dynamic = "force-dynamic"

type ClaimBody = {
  tokenOrSerial: string
  ownerIdentifier: string
  ownerName?: string
}

export async function POST(request: Request) {
  const ctx = await buildRequestContext()

  let body: ClaimBody
  try {
    body = (await request.json()) as ClaimBody
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const tokenOrSerial = body.tokenOrSerial?.trim()
  const ownerIdentifier = body.ownerIdentifier?.trim()

  if (!tokenOrSerial) {
    return fail(ctx.traceId, "tokenOrSerial is required.", 400)
  }
  if (!ownerIdentifier) {
    return fail(ctx.traceId, "ownerIdentifier (email or phone) is required.", 400)
  }

  const result = await claimOwnership({
    tokenOrSerial,
    ownerIdentifier,
    ownerName: body.ownerName?.trim(),
    userId: null,
  })

  if (!result.success) {
    return fail(ctx.traceId, result.error ?? "Claim failed.", 400)
  }

  return ok(ctx.traceId, {
    success: true,
    ownershipId: result.ownershipId,
    message: "You are now the verified owner of this product.",
  })
}
