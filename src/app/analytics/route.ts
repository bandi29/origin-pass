import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { getAuthenticatedUser } from "@/backend/modules/auth/service"
import {
  NIL_UUID,
  getScopedPassportIds,
  getScopedProductIds,
} from "@/backend/modules/organizations/scope"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const ctx = await buildRequestContext()
  const user = await getAuthenticatedUser()
  if (!user) return fail(ctx.traceId, "Unauthorized.", 401)

  const admin = createAdminClient()
  const [productIds, passportIds] = await Promise.all([
    getScopedProductIds(user.id),
    getScopedPassportIds(user.id),
  ])

  const [passportCountResult, totalScansResult, suspiciousScansResult] =
    await Promise.all([
      admin
        .from("passports")
        .select("id", { head: true, count: "exact" })
        .in("product_id", productIds.length ? productIds : [NIL_UUID]),
      admin
        .from("passport_scans")
        .select("id", { head: true, count: "exact" })
        .in("passport_id", passportIds.length ? passportIds : [NIL_UUID]),
      admin
        .from("passport_scans")
        .select("id", { head: true, count: "exact" })
        .in("passport_id", passportIds.length ? passportIds : [NIL_UUID])
        .eq("scan_result", "suspicious"),
    ])

  if (
    passportCountResult.error ||
    totalScansResult.error ||
    suspiciousScansResult.error
  ) {
    return fail(ctx.traceId, "Failed to compute analytics.", 500)
  }

  const totalPassports = passportCountResult.count ?? 0
  const totalScans = totalScansResult.count ?? 0
  const suspiciousScans = suspiciousScansResult.count ?? 0

  return ok(ctx.traceId, {
    totalPassports,
    totalScans,
    suspiciousScans,
    verificationRate:
      totalScans > 0
        ? Math.max(0, 100 - (suspiciousScans / totalScans) * 100)
        : null,
  })
}
