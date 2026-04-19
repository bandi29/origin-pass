import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { getAuthenticatedUser } from "@/backend/modules/auth/service"
import { createVerificationEvent } from "@/backend/modules/verifications/repository"
import {
  getScopedPassportIds,
  NIL_UUID,
} from "@/backend/modules/organizations/scope"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidSerialId, isValidUuid } from "@/lib/security"

type VerificationBody = {
  passportId?: string
  serialId?: string
  verificationType?: string
  status?: "pending" | "approved" | "rejected"
  reviewNotes?: string
}

export async function POST(request: Request) {
  const ctx = await buildRequestContext()
  const user = await getAuthenticatedUser()
  if (!user) return fail(ctx.traceId, "Unauthorized.", 401)

  let body: VerificationBody
  try {
    body = (await request.json()) as VerificationBody
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const passportId = body.passportId?.trim()
  const serialId = body.serialId?.trim()

  if (!passportId && !serialId) {
    return fail(ctx.traceId, "passportId or serialId is required.", 400)
  }

  const scopedPassportIds = await getScopedPassportIds(user.id)
  const admin = createAdminClient()
  let resolvedPassportId: string | null = null

  if (passportId) {
    if (!isValidUuid(passportId)) {
      return fail(ctx.traceId, "Invalid passportId.", 400)
    }
    if (!scopedPassportIds.includes(passportId)) {
      return fail(ctx.traceId, "Forbidden.", 403)
    }
    resolvedPassportId = passportId
  } else if (serialId) {
    if (!isValidSerialId(serialId)) {
      return fail(ctx.traceId, "Invalid serialId.", 400)
    }
    const { data: passport } = await admin
      .from("passports")
      .select("id")
      .eq("serial_number", serialId)
      .in("id", scopedPassportIds.length ? scopedPassportIds : [NIL_UUID])
      .maybeSingle()

    if (!passport?.id) return fail(ctx.traceId, "Passport not found.", 404)
    resolvedPassportId = passport.id
  }

  if (!resolvedPassportId) return fail(ctx.traceId, "Passport not found.", 404)

  const created = await createVerificationEvent({
    passportId: resolvedPassportId,
    verificationType: body.verificationType?.trim() || "manual_review",
    status: body.status || "pending",
    reviewNotes: body.reviewNotes?.trim() || "Manual verification created.",
  })

  if (!created) {
    return fail(ctx.traceId, "Failed to create verification.", 500)
  }

  return ok(
    ctx.traceId,
    {
      verification: {
        id: created.id,
        passportId: created.passport_id,
        verificationType: created.verification_type,
        status: created.status,
        createdAt: created.created_at,
      },
    },
    201
  )
}
