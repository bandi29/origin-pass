import { z } from "zod"
import { claimOwnership } from "@/backend/modules/ownership/service"
import { ok, fail } from "@/backend/api/gateway"
import { buildRequestContext } from "@/backend/middleware/request-context"
import { checkRateLimitAsync } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const E164_RE = /^\+[1-9]\d{1,14}$/

const claimSchema = z.object({
  tokenOrSerial: z.string().trim().min(1, "tokenOrSerial is required.").max(256),
  ownerIdentifier: z
    .string()
    .trim()
    .min(1, "ownerIdentifier (email or phone) is required.")
    .max(254)
    .refine((v) => EMAIL_RE.test(v) || E164_RE.test(v), {
      message: "ownerIdentifier must be a valid email or E.164 phone number.",
    }),
  ownerName: z.string().trim().max(200).optional(),
})

export async function POST(request: Request) {
  const ctx = await buildRequestContext()

  if (!(await checkRateLimitAsync(ctx.ipAddress)).ok) {
    return fail(ctx.traceId, "Too many requests. Try again later.", 429)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const parsed = claimSchema.safeParse(json)
  if (!parsed.success) {
    return fail(ctx.traceId, parsed.error.issues[0]?.message ?? "Invalid request.", 400)
  }

  const result = await claimOwnership({
    tokenOrSerial: parsed.data.tokenOrSerial,
    ownerIdentifier: parsed.data.ownerIdentifier.toLowerCase(),
    ownerName: parsed.data.ownerName,
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
