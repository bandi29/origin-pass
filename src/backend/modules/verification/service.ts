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
  verification_status?: string | null
  anomaly_details?: Array<{
    type: string
    severity: string
    message: string
    score_change: number
    triggered_at: string
  }>
  recent_scan_activity?: Array<{
    scanned_at: string
    country: string | null
    city: string | null
    source: string | null
  }>
  ownership_validation?: {
    chain_broken: boolean
    latest_owner_type: string | null
    total_transfers: number
  }
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
    .select("id, product_id, product:products(id, name, brand_id, verification_status, risk_score)")
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

  const productId = (product as { id?: string })?.id ?? null

  const [recentScanActivity, anomalyEvents, ownershipChain] = productId
    ? await Promise.all([
        admin
          .from("scan_events")
          .select("scanned_at, geo_country, geo_city, scan_source")
          .eq("product_id", productId)
          .order("scanned_at", { ascending: false })
          .limit(5),
        admin
          .from("verification_events")
          .select("event_type, event_message, score_change, triggered_at, metadata_json")
          .eq("product_id", productId)
          .order("triggered_at", { ascending: false })
          .limit(6),
        admin
          .from("ownership_chain")
          .select("owner_type, transferred_at")
          .eq("product_id", productId)
          .order("transferred_at", { ascending: true }),
      ])
    : [null, null, null]

  const ownershipRows = (ownershipChain?.data ?? []) as Array<{
    owner_type: string
    transferred_at: string
  }>
  const ownerOrder = ["manufacturer", "distributor", "retailer", "customer"]
  let chainBroken = false
  for (let i = 1; i < ownershipRows.length; i += 1) {
    if (
      ownerOrder.indexOf(ownershipRows[i]!.owner_type) <
      ownerOrder.indexOf(ownershipRows[i - 1]!.owner_type)
    ) {
      chainBroken = true
      break
    }
  }

  return {
    status,
    product_name: productName,
    brand: brandName,
    message,
    scan_count: scanCount,
    first_scan_date: firstScanDate,
    risk_score: Number((product as { risk_score?: number | null })?.risk_score ?? result.riskScore ?? 0),
    verification_status:
      (product as { verification_status?: string | null })?.verification_status ?? null,
    anomaly_details: ((anomalyEvents?.data ?? []) as Array<{
      event_type: string
      event_message: string
      score_change: number
      triggered_at: string
      metadata_json: { severity?: string } | null
    }>).map((e) => ({
      type: e.event_type,
      severity: e.metadata_json?.severity ?? "medium",
      message: e.event_message,
      score_change: e.score_change,
      triggered_at: e.triggered_at,
    })),
    recent_scan_activity: ((recentScanActivity?.data ?? []) as Array<{
      scanned_at: string
      geo_country: string | null
      geo_city: string | null
      scan_source: string | null
    }>).map((r) => ({
      scanned_at: r.scanned_at,
      country: r.geo_country,
      city: r.geo_city,
      source: r.scan_source,
    })),
    ownership_validation: {
      chain_broken: chainBroken,
      latest_owner_type: ownershipRows.length
        ? ownershipRows[ownershipRows.length - 1]!.owner_type
        : null,
      total_transfers: ownershipRows.length,
    },
  }
}
