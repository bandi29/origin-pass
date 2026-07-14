/**
 * Public scan entry point.
 *
 * Architecture (post Sprint 1–2 + Month 1 refactor):
 *
 *   Request → processScan()
 *               1. validate token shape
 *               2. find passport (single OR query)
 *               3. compute fraud signals (single SQL function call)
 *               4. derive verdict
 *               5. ENQUEUE scan-pipeline job with all writes
 *               6. return verdict to caller — response unblocked
 *
 *   Worker → executeScanWritePipeline()
 *               • passport_scans insert
 *               • fraud orchestrator + product risk update
 *               • scan_events insert
 *               • qr_identities counter
 *               • verification_events insert
 *               • notification
 *
 * Why: the previous synchronous implementation did 15–20 round-trips inline,
 * blocking the verify response for 300–800 ms p95. Moving writes off-path is
 * the single largest performance win available on the hot path.
 */
import { isValidSerialId, isValidUuid } from "@/lib/security"
import { isValidVerifyToken } from "@/lib/verify-token"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import { computeScanFraudSignals } from "@/backend/modules/analytics/repository"
import { runFraudDetection } from "@/backend/services/ai_detection"
import { enqueueScanPipeline } from "@/lib/scan-pipeline/queue"
import { logger, getLogContext } from "@/lib/logger"
import { addSpanAttribute, withSpan } from "@/lib/tracing"

export type ProcessScanInput = {
  serialId: string
  ipAddress: string | null
  userAgent: string | null
  city: string | null
  country: string | null
  region?: string | null
  locationLabel?: string | null
  scanSource?: string
}

export type ProcessScanResult = {
  verdict: "verified" | "not_found" | "suspicious" | "fraud"
  riskScore: number
  reason: string
  status: "valid" | "suspicious" | "fraud"
  passportId?: string
}

export async function processScan(
  input: ProcessScanInput,
): Promise<ProcessScanResult> {
  return withSpan("scan.process", { hasIp: Boolean(input.ipAddress) }, () =>
    processScanImpl(input),
  )
}

async function processScanImpl(input: ProcessScanInput): Promise<ProcessScanResult> {
  const sid = input.serialId.trim()
  const isValid =
    isValidVerifyToken(sid) || isValidSerialId(sid) || isValidUuid(sid)
  if (!isValid) {
    addSpanAttribute("scan.verdict", "not_found")
    return {
      verdict: "not_found",
      riskScore: 0,
      reason: "Invalid token or serial format.",
      status: "valid",
    }
  }

  // Step 1: single-OR-query passport lookup (was 3–4 sequential queries).
  const passport = await withSpan("scan.lookup", { sid: sid.slice(0, 12) }, () =>
    findPassportByTokenOrSerial(sid),
  )
  if (!passport) {
    return {
      verdict: "not_found",
      riskScore: 0,
      reason: "Passport not found.",
      status: "valid",
    }
  }

  // Step 2: single SQL function call returning all 5 fraud counters at once
  // (was 5 separate Supabase round-trips).
  const signals = await withSpan(
    "scan.fraud-signals",
    { passportId: passport.id },
    () => computeScanFraudSignals(passport.id, input.ipAddress),
  )

  const fraud = runFraudDetection({
    recentScans: signals.recentScans,
    sameIpRecentScans: signals.sameIpRecentScans,
    distinctCountriesLastHour: signals.distinctCountriesLastHour,
    scansLastMinute: signals.scansLastMinute,
    isFirstScan: signals.totalScanCount === 0,
    totalScanCount: signals.totalScanCount,
  })

  const verdict: ProcessScanResult["verdict"] =
    fraud.status === "fraud"
      ? "fraud"
      : fraud.status === "suspicious"
        ? "suspicious"
        : "verified"

  addSpanAttribute("scan.verdict", verdict)
  addSpanAttribute("scan.risk_score", fraud.riskScore)

  // Step 3: enqueue all writes. The verify response does NOT wait for these.
  // (The exception path below still returns the verdict synchronously.)
  const traceId = getLogContext()?.traceId as string | undefined
  try {
    await enqueueScanPipeline({
      passport: {
        id: passport.id,
        productId: passport.product_id ?? null,
        organizationId: passport.organization_id ?? null,
        serialNumber: passport.serial_number ?? null,
      },
      scan: {
        timestamp: new Date().toISOString(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        city: input.city,
        country: input.country,
        region: input.region ?? null,
        locationLabel: input.locationLabel ?? null,
        scanSource: input.scanSource ?? "verify_page",
      },
      fraud: {
        riskScore: fraud.riskScore,
        status: fraud.status,
        reason: fraud.reason,
        totalScanCount: signals.totalScanCount,
      },
      serialId: input.serialId,
      verdict,
      traceId,
    })
  } catch (err) {
    // Enqueue failure must not break the public response. The verdict is still
    // accurate — the analytics writes are best-effort.
    logger.warn(
      {
        scope: "process-scan",
        passportId: passport.id,
        errMessage: err instanceof Error ? err.message : String(err),
      },
      "scan-pipeline.enqueue.failed",
    )
  }

  return {
    verdict,
    riskScore: fraud.riskScore,
    reason: fraud.reason,
    status: fraud.status,
    passportId: passport.id,
  }
}
