import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { getPassportVerificationPanelPayload } from "@/lib/passport-verification-history-server"

export type PassportDetailRecord = {
  id: string
  passportUid: string
  productId: string
  productName?: string
  serialNumber: string
  verifyToken?: string
  status: string
  createdAt: string
}

export type PassportContentRecord = {
  story: string
  materials: string
  origin: string
  lifecycle: string
}

export type PassportScanRecord = {
  id: string
  scan_timestamp: string
  location_country: string | null
  location_city: string | null
  device_type: string | null
  scan_result: string
}

export async function loadPassportDetailForUser(
  userId: string,
  passportId: string,
): Promise<{
  passport: PassportDetailRecord
  content: PassportContentRecord
  scans: PassportScanRecord[]
  verificationComplianceStatus: Awaited<
    ReturnType<typeof getPassportVerificationPanelPayload>
  >["complianceStatus"]
  verificationHistory: Awaited<
    ReturnType<typeof getPassportVerificationPanelPayload>
  >["history"]
  baseUrl: string
} | null> {
  if (!isValidUuid(passportId)) return null

  const inScope = await isPassportInScope(userId, passportId)
  if (!inScope) return null

  const admin = createAdminClient()

  const { data: passport, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, product_id, serial_number, verify_token, status, created_at, product:products(id,name,story,materials,origin,lifecycle)",
    )
    .eq("id", passportId)
    .maybeSingle()

  if (error || !passport) return null

  const product = (Array.isArray(passport.product) ? passport.product[0] : passport.product) as
    | {
        id?: string
        name?: string
        story?: string | null
        materials?: string | null
        origin?: string | null
        lifecycle?: string | null
      }
    | null
    | undefined

  const { data: scans } = await admin
    .from("passport_scans")
    .select("id, scan_timestamp, location_country, location_city, device_type, scan_result")
    .eq("passport_id", passportId)
    .order("scan_timestamp", { ascending: false })
    .limit(50)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const verificationPayload = await getPassportVerificationPanelPayload(userId, passportId)

  return {
    passport: {
      id: passport.id,
      passportUid: passport.passport_uid,
      productId: passport.product_id,
      productName: product?.name,
      serialNumber: passport.serial_number,
      verifyToken: (passport as { verify_token?: string | null }).verify_token ?? undefined,
      status: passport.status,
      createdAt: passport.created_at,
    },
    content: {
      story: product?.story ?? "",
      materials: product?.materials ?? "",
      origin: product?.origin ?? "",
      lifecycle: product?.lifecycle ?? "",
    },
    scans: (scans ?? []) as PassportScanRecord[],
    verificationComplianceStatus: verificationPayload.complianceStatus,
    verificationHistory: verificationPayload.history,
    baseUrl,
  }
}
