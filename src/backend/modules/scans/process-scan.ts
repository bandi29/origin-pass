import { isValidSerialId, isValidUuid } from "@/lib/security"
import { isValidVerifyToken } from "@/lib/verify-token"
import { createAdminClient } from "@/lib/supabase/admin"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import {
  countRecentScans,
  countRecentScansByIp,
  countDistinctCountriesLastHour,
  getTotalScanCount,
  countScansLastMinute,
} from "@/backend/modules/analytics/repository"
import { createVerificationEvent } from "@/backend/modules/verifications/repository"
import { runFraudDetection } from "@/backend/services/ai_detection"
import { notifyOnSuspiciousScan } from "@/backend/services/notifications"

export type ProcessScanInput = {
  serialId: string
  ipAddress: string | null
  userAgent: string | null
  city: string | null
  country: string | null
}

export type ProcessScanResult = {
  verdict: "verified" | "not_found" | "suspicious" | "fraud"
  riskScore: number
  reason: string
  status: "valid" | "suspicious" | "fraud"
  passportId?: string
}

export async function processScan(
  input: ProcessScanInput
): Promise<ProcessScanResult> {
  const sid = input.serialId.trim()
  const isValid =
    isValidVerifyToken(sid) || isValidSerialId(sid) || isValidUuid(sid)
  if (!isValid) {
    return {
      verdict: "not_found",
      riskScore: 0,
      reason: "Invalid token or serial format.",
      status: "valid",
    }
  }

  const passport = await findPassportByTokenOrSerial(sid)
  if (!passport) {
    return {
      verdict: "not_found",
      riskScore: 0,
      reason: "Passport not found.",
      status: "valid",
    }
  }

  const [
    recentScans,
    sameIpRecentScans,
    distinctCountries,
    totalScanCount,
    scansLastMinute,
  ] = await Promise.all([
    countRecentScans(passport.id, 15),
    countRecentScansByIp(passport.id, input.ipAddress, 15),
    countDistinctCountriesLastHour(passport.id),
    getTotalScanCount(passport.id),
    countScansLastMinute(passport.id),
  ])

  const fraud = runFraudDetection({
    recentScans,
    sameIpRecentScans,
    distinctCountriesLastHour: distinctCountries,
    scansLastMinute,
    isFirstScan: totalScanCount === 0,
    totalScanCount,
  })

  const verdict: ProcessScanResult["verdict"] =
    fraud.status === "fraud"
      ? "fraud"
      : fraud.status === "suspicious"
        ? "suspicious"
        : "verified"

  const admin = createAdminClient()
  // passport_scan_result enum: valid, duplicate, invalid, suspicious (no fraud)
  const scanResult =
    fraud.status === "valid" ? "valid" : "suspicious"

  const scanRecord: Record<string, unknown> = {
    passport_id: passport.id,
    scan_timestamp: new Date().toISOString(),
    location_country: input.country,
    location_city: input.city,
    device_type: input.userAgent,
    ip_address: input.ipAddress,
    scan_result: scanResult,
    risk_score: fraud.riskScore,
  }
  if (passport.organization_id) {
    scanRecord.organization_id = passport.organization_id
  }

  const { error: scanError } = await admin.from("passport_scans").insert(scanRecord)

  if (scanError) {
    console.warn("processScan insert passport_scans error:", scanError.message)
  }

  await createVerificationEvent({
    passportId: passport.id,
    verificationType: "public_scan",
    status: verdict === "verified" ? "approved" : "pending",
    reviewNotes:
      verdict === "verified"
        ? "Auto-approved by scan pipeline."
        : "Suspicious pattern detected by scan pipeline.",
  })

  await notifyOnSuspiciousScan({
    passportSerial: input.serialId,
    verdict,
    riskScore: fraud.riskScore,
  })

  return {
    verdict,
    riskScore: fraud.riskScore,
    reason: fraud.reason,
    status: fraud.status,
    passportId: passport.id,
  }
}
