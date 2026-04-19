import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { getAuthenticatedUser } from "@/backend/modules/auth/service"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUuid } from "@/lib/security"

type PassportDetailsRow = {
  id: string
  passport_uid: string
  product_id: string
  serial_number: string
  status: string
  created_at: string
  product: {
    id?: string
    name?: string
    brand_id?: string
    organization_id?: string
  } | {
    id?: string
    name?: string
    brand_id?: string
    organization_id?: string
  }[] | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await buildRequestContext()
  const user = await getAuthenticatedUser()
  if (!user) return fail(ctx.traceId, "Unauthorized.", 401)

  const { id } = await params
  if (!isValidUuid(id)) return fail(ctx.traceId, "Invalid passport id.", 400)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, product_id, serial_number, status, created_at, product:products(id,name,brand_id,organization_id)"
    )
    .eq("id", id)
    .maybeSingle()

  if (error) return fail(ctx.traceId, "Failed to fetch passport.", 500)
  if (!data) return fail(ctx.traceId, "Passport not found.", 404)

  const row = data as PassportDetailsRow
  const product = Array.isArray(row.product) ? row.product[0] : row.product
  const scopedProductIds = await getScopedProductIds(user.id)
  if (!product?.id || !scopedProductIds.includes(product.id)) {
    return fail(ctx.traceId, "Forbidden.", 403)
  }

  return ok(ctx.traceId, {
    passport: {
      id: row.id,
      passportUid: row.passport_uid,
      productId: row.product_id,
      productName: product.name,
      serialNumber: row.serial_number,
      status: row.status,
      createdAt: row.created_at,
    },
  })
}
