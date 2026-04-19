import { buildRequestContext } from "@/backend/middleware/request-context"
import { fail, ok } from "@/backend/api/gateway"
import { getAuthenticatedUser } from "@/backend/modules/auth/service"
import {
  NIL_UUID,
  getScopedProductIds,
} from "@/backend/modules/organizations/scope"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidSerialId, isValidUuid } from "@/lib/security"

type CreatePassportBody = {
  productId?: string
  serialNumber?: string
  passportUid?: string
  status?: "active" | "revoked" | "expired" | "counterfeit_flagged"
}

type PassportRow = {
  id: string
  passport_uid: string
  product_id: string
  serial_number: string
  status: string
  created_at: string
  product: { id?: string; name?: string } | { id?: string; name?: string }[] | null
}

export async function GET() {
  const ctx = await buildRequestContext()
  const user = await getAuthenticatedUser()
  if (!user) return fail(ctx.traceId, "Unauthorized.", 401)

  const productIds = await getScopedProductIds(user.id)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, product_id, serial_number, status, created_at, product:products(id,name)"
    )
    .in("product_id", productIds.length ? productIds : [NIL_UUID])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return fail(ctx.traceId, "Failed to fetch passports.", 500)
  }

  const rows = ((data ?? []) as PassportRow[]).map((row) => ({
    id: row.id,
    passportUid: row.passport_uid,
    productId: row.product_id,
    productName: Array.isArray(row.product) ? row.product[0]?.name : row.product?.name,
    serialNumber: row.serial_number,
    status: row.status,
    createdAt: row.created_at,
  }))

  return ok(ctx.traceId, { passports: rows })
}

export async function POST(request: Request) {
  const ctx = await buildRequestContext()
  const user = await getAuthenticatedUser()
  if (!user) return fail(ctx.traceId, "Unauthorized.", 401)

  let body: CreatePassportBody
  try {
    body = (await request.json()) as CreatePassportBody
  } catch {
    return fail(ctx.traceId, "Invalid JSON body.", 400)
  }

  const productId = body.productId?.trim()
  const serialNumber = body.serialNumber?.trim()
  const passportUid = body.passportUid?.trim() || serialNumber
  const status = body.status || "active"

  if (!productId || !isValidUuid(productId)) {
    return fail(ctx.traceId, "Valid productId is required.", 400)
  }
  if (!serialNumber || !isValidSerialId(serialNumber)) {
    return fail(ctx.traceId, "Valid serialNumber is required.", 400)
  }
  if (!passportUid || !isValidSerialId(passportUid)) {
    return fail(ctx.traceId, "Valid passportUid is required.", 400)
  }

  const productIds = await getScopedProductIds(user.id)
  if (!productIds.includes(productId)) {
    return fail(ctx.traceId, "Product does not belong to your account.", 403)
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("passports")
    .insert({
      product_id: productId,
      serial_number: serialNumber,
      passport_uid: passportUid,
      status,
    })
    .select("id, passport_uid, product_id, serial_number, status, created_at")
    .single()

  if (error || !data) {
    return fail(ctx.traceId, error?.message || "Failed to create passport.", 400)
  }

  return ok(
    ctx.traceId,
    {
      passport: {
        id: data.id,
        passportUid: data.passport_uid,
        productId: data.product_id,
        serialNumber: data.serial_number,
        status: data.status,
        createdAt: data.created_at,
      },
    },
    201
  )
}
