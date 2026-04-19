"use server"

import { randomBytes } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { generateSerialId } from "@/lib/crypto"
import { generateVerifyToken } from "@/lib/verify-token"

export type CreatePassportInput = {
  productId: string
  serialFormat?: string
  batchSize?: number
  manufacturingDate?: string
  originCountry?: string
}

export type CreatePassportResult = {
  success: boolean
  passport?: {
    id: string
    passportUid: string
    serialNumber: string
    verifyToken: string
    status: string
    createdAt: string
  }
  error?: string
}

function generateSerialFromFormat(format: string, seq: number): string {
  const year = new Date().getFullYear()
  const uniqueSuffix = randomBytes(4).toString("hex").toUpperCase()
  let base = format
    .replace(/\{SEQ\}/gi, String(seq))
    .replace(/\{YYYY\}/gi, String(year))
    .replace(/\{YY\}/gi, String(year).slice(-2))
    .replace(/\{RAND\}/gi, uniqueSuffix)
  if (format.includes("{SEQ}") && !base.includes(uniqueSuffix)) {
    base = `${base}-${uniqueSuffix}`
  }
  return base
}

export async function createPassportAction(
  input: CreatePassportInput
): Promise<CreatePassportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Please sign in to create a passport." }
  }

  const productId = input.productId?.trim()
  const batchSize = Math.min(Math.max(1, input.batchSize ?? 1), 100)
  const serialFormat = input.serialFormat || "OP-{SEQ}"

  if (!productId || !isValidUuid(productId)) {
    return { success: false, error: "Valid product is required." }
  }

  const productIds = await getScopedProductIds(user.id)
  const productIdSet = new Set(productIds)
  if (!productIdSet.has(productId)) {
    return { success: false, error: "Product not found." }
  }

  const admin = createAdminClient()
  let lastCreated: {
    id: string
    passport_uid: string
    serial_number: string
    verify_token: string | null
    status: string
    created_at: string
  } | null = null

  for (let i = 0; i < batchSize; i++) {
    const serialNumber =
      serialFormat.includes("{SEQ}") || serialFormat.includes("{YYYY}")
        ? generateSerialFromFormat(serialFormat, i + 1)
        : generateSerialId(
            serialFormat.replace(/[^A-Za-z0-9]/g, "").slice(0, 4) || "OP"
          )

    const verifyToken = generateVerifyToken()
    const { data, error } = await admin
      .from("passports")
      .insert({
        product_id: productId,
        serial_number: serialNumber,
        passport_uid: serialNumber,
        verify_token: verifyToken,
        status: "active",
      })
      .select("id, passport_uid, product_id, serial_number, verify_token, status, created_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `Serial "${serialNumber}" already exists. Try a different format.`,
        }
      }
      return {
        success: false,
        error: error.message || "Failed to create passport.",
      }
    }

    if (data) lastCreated = data
  }

  if (lastCreated) {
    return {
      success: true,
      passport: {
        id: lastCreated.id,
        passportUid: lastCreated.passport_uid,
        serialNumber: lastCreated.serial_number,
        verifyToken: lastCreated.verify_token ?? lastCreated.passport_uid,
        status: lastCreated.status,
        createdAt: lastCreated.created_at,
      },
    }
  }

  return { success: false, error: "Failed to create passport." }
}
