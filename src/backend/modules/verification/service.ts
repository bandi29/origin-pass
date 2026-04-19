import { createAdminClient } from "@/lib/supabase/admin"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import {
  getTotalScanCount,
  getFirstScanDate,
} from "@/backend/modules/analytics/repository"
import { processScan } from "@/backend/modules/scans/process-scan"
import { buildRequestContext } from "@/backend/middleware/request-context"

export type VerificationApiResponse = {
  status: "valid" | "suspicious" | "fraud" | "not_found"
  product_name: string
  brand: string
  message: string
  scan_count: number
  first_scan_date: string | null
  risk_score?: number
  ownership_status?: "claimed" | "unclaimed"
}

export async function verifyAndGetResponse(
  tokenOrSerial: string,
  ctx: { ipAddress: string | null; userAgent: string | null; city: string | null; country: string | null }
): Promise<VerificationApiResponse> {
  const passport = await findPassportByTokenOrSerial(tokenOrSerial)
  if (!passport) {
    return {
      status: "not_found",
      product_name: "",
      brand: "",
      message: "Passport not found.",
      scan_count: 0,
      first_scan_date: null,
    }
  }

  const result = await processScan({
    serialId: tokenOrSerial,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    city: ctx.city,
    country: ctx.country,
  })

  if (result.verdict === "not_found") {
    return {
      status: "not_found",
      product_name: "",
      brand: "",
      message: result.reason,
      scan_count: 0,
      first_scan_date: null,
    }
  }

  const admin = createAdminClient()
  const { data: passportWithProduct } = await admin
    .from("passports")
    .select("id, product_id, product:products(id, name, brand_id)")
    .eq("id", passport.id)
    .single()

  const product = Array.isArray(passportWithProduct?.product)
    ? passportWithProduct?.product?.[0]
    : passportWithProduct?.product
  const productName = (product as { name?: string })?.name ?? "Product"
  const brandId = (product as { brand_id?: string })?.brand_id

  let brandName = "Unknown"
  if (brandId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("brand_name")
      .eq("id", brandId)
      .single()
    brandName = profile?.brand_name ?? "Unknown"
  }

  const [scanCount, firstScanDate] = await Promise.all([
    getTotalScanCount(passport.id),
    getFirstScanDate(passport.id),
  ])

  const status: VerificationApiResponse["status"] =
    result.verdict === "fraud"
      ? "fraud"
      : result.verdict === "suspicious"
        ? "suspicious"
        : "valid"

  const message =
    status === "valid"
      ? "Authenticity confirmed."
      : status === "suspicious"
        ? "Unusual scan activity detected. Please verify product authenticity."
        : "Potential fraud detected. Contact the brand."

  return {
    status,
    product_name: productName,
    brand: brandName,
    message,
    scan_count: scanCount,
    first_scan_date: firstScanDate,
    risk_score: result.riskScore,
  }
}
