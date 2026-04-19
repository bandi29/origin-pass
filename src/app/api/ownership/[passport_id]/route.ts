import { getOwnershipForPassport } from "@/backend/modules/ownership/service"
import { ok, fail } from "@/backend/api/gateway"
import { buildRequestContext } from "@/backend/middleware/request-context"
import { isValidUuid } from "@/lib/security"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ passport_id: string }> }
) {
  const ctx = await buildRequestContext()
  const { passport_id } = await params

  if (!isValidUuid(passport_id)) {
    return fail(ctx.traceId, "Invalid passport ID.", 400)
  }

  const { current, history } = await getOwnershipForPassport(passport_id)

  return ok(ctx.traceId, {
    current,
    history,
  })
}
