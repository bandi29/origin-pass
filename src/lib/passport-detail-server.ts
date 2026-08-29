import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { getPassportVerificationPanelPayload } from "@/lib/passport-verification-history-server"
import {
  parseTranslationsColumn,
  type PassportTranslationsColumn,
} from "@/lib/passport-eu-fields"
import { computeEsprComplianceScore, type EsprComplianceResult } from "@/lib/complianceScore"
import type { GpsrData } from "@/lib/passport-wizard-schemas"

export type PassportDetailRecord = {
  id: string
  passportUid: string
  productId: string
  productName?: string
  serialNumber: string
  verifyToken?: string
  status: string
  createdAt: string
  gtin?: string | null
  sku?: string | null
  gpsr?: GpsrData | null
}

export type PassportContentRecord = {
  story: string
  materials: string
  origin: string
  lifecycle: string
  /** Cached EU DPP translations on `passports.translations` (fr/de/es/it). */
  translations: PassportTranslationsColumn
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
  esprScore: EsprComplianceResult
} | null> {
  if (!isValidUuid(passportId)) return null

  const inScope = await isPassportInScope(userId, passportId)
  if (!inScope) return null

  const admin = createAdminClient()

  const { data: passport, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, product_id, serial_number, verify_token, status, created_at, translations, gpsr, gtin, metadata, product:products(id,name,story,materials,origin,lifecycle,sku,gtin)",
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
        sku?: string | null
        gtin?: string | null
      }
    | null
    | undefined

  const wizardMeta = (passport as { metadata?: { wizard?: { customFields?: Record<string, string> } } })
    .metadata?.wizard
  const recycled =
    wizardMeta?.customFields?.recycled_content_pct ??
    wizardMeta?.customFields?.recycled_content ??
    null

  const gpsrRaw = (passport as { gpsr?: unknown }).gpsr
  const gpsr =
    gpsrRaw && typeof gpsrRaw === "object" ? (gpsrRaw as GpsrData) : null

  const passportGtin =
    ((passport as { gtin?: string | null }).gtin as string | null) ||
    product?.gtin ||
    gpsr?.productIdentifiers?.gtin ||
    null

  const { data: scans } = await admin
    .from("passport_scans")
    .select("id, scan_timestamp, location_country, location_city, device_type, scan_result")
    .eq("passport_id", passportId)
    .order("scan_timestamp", { ascending: false })
    .limit(50)

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const verificationPayload = await getPassportVerificationPanelPayload(userId, passportId)

  const content: PassportContentRecord = {
    story: product?.story ?? "",
    materials: product?.materials ?? "",
    origin: product?.origin ?? "",
    lifecycle: product?.lifecycle ?? "",
    translations: parseTranslationsColumn(
      (passport as { translations?: unknown }).translations,
    ),
  }

  const esprScore = computeEsprComplianceScore({
    materialComposition: content.materials,
    countryOfOrigin: content.origin,
    gtin: passportGtin,
    sku: product?.sku ?? null,
    gpsr,
    recycledContentPct: recycled,
    careInstructions: content.lifecycle,
    hasCertificationsOrDocuments: verificationPayload.complianceStatus === "verified",
    passportId,
    productId: passport.product_id,
  })

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
      gtin: passportGtin,
      sku: product?.sku ?? null,
      gpsr,
    },
    content,
    scans: (scans ?? []) as PassportScanRecord[],
    verificationComplianceStatus: verificationPayload.complianceStatus,
    verificationHistory: verificationPayload.history,
    baseUrl,
    esprScore,
  }
}
