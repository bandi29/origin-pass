/**
 * Worker entry: execute all the database writes a scan triggers, given a fully
 * self-contained job payload. This is the "slow half" of processScan, lifted out
 * of the request path so the verify response can return as soon as the verdict is
 * computed.
 *
 * Order of operations (kept identical to the original synchronous version so
 * downstream invariants — verification_events, fraud orchestrator outputs, qr
 * identity counters — remain unchanged):
 *   1. Insert passport_scans row.
 *   2. If passport has a product → fetch product + qr_identity, run fraud
 *      orchestrator, persist outputs, update product.risk_score + verification_status.
 *   3. Insert scan_events row with denormalized organization_id.
 *   4. Increment qr_identities counter (RPC, fallback to manual update).
 *   5. Insert verification_events row.
 *   6. Notify on suspicious / fraud verdicts.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { createVerificationEvent } from "@/backend/modules/verifications/repository"
import { notifyOnSuspiciousScan } from "@/backend/services/notifications"
import {
  persistVerificationOutputs,
  runVerificationOrchestrator,
} from "@/backend/modules/verification-engine"
import type { ScanPipelineJob } from "@/lib/scan-pipeline/queue"
import { logger, serializeError } from "@/lib/logger"

export async function executeScanWritePipeline(job: ScanPipelineJob): Promise<void> {
  const admin = createAdminClient()
  const { passport, scan, fraud, verdict, serialId, traceId } = job
  const log = (level: "info" | "warn" | "error", fields: Record<string, unknown>, msg: string) => {
    logger[level]({ scope: "scan-pipeline", traceId, passportId: passport.id, ...fields }, msg)
  }

  // 1) Raw scan event in passport_scans. After Phase 6 schema migration, this
  // row carries every column the legacy `scan_events` table held — product_id,
  // qr_identity_id, device_fingerprint, user_agent, scan_source, metadata_json
  // — so downstream analytics can read from one table once cutover lands.
  const scanResult = fraud.status === "valid" ? "valid" : "suspicious"
  const scanRecord: Record<string, unknown> = {
    passport_id: passport.id,
    scan_timestamp: scan.timestamp,
    location_country: scan.country,
    location_city: scan.city,
    device_type: scan.userAgent,
    ip_address: scan.ipAddress,
    scan_result: scanResult,
    risk_score: fraud.riskScore,
    product_id: passport.productId,
    device_fingerprint: scan.userAgent,
    user_agent: scan.userAgent,
    scan_source: scan.scanSource,
    metadata_json: {
      region: scan.region,
      location_label: scan.locationLabel,
    },
  }
  if (passport.organizationId) scanRecord.organization_id = passport.organizationId

  const { error: scanError } = await admin.from("passport_scans").insert(scanRecord)
  if (scanError) {
    log("warn", { errMessage: scanError.message }, "passport_scans.insert.failed")
  }

  // 2–4) Product-scoped writes.
  if (passport.productId) {
    try {
      const [productRow, qrIdentityRow] = await Promise.all([
        admin
          .from("products")
          .select("id, sku, serial_number, origin_country, supplier_id, risk_score")
          .eq("id", passport.productId)
          .maybeSingle(),
        admin
          .from("products")
          .select("qr_identity_id")
          .eq("id", passport.productId)
          .maybeSingle(),
      ])

      const orchestrator = await runVerificationOrchestrator(
        {
          supabase: admin,
          organizationId: passport.organizationId ?? null,
          actor: "system",
        },
        {
          currentRiskScore: Number(productRow.data?.risk_score ?? 0),
          product: {
            productId: passport.productId,
            sku: productRow.data?.sku ?? null,
            serialNumber: productRow.data?.serial_number ?? null,
            originCountry: productRow.data?.origin_country ?? null,
            supplierId: productRow.data?.supplier_id ?? null,
          },
          scanSignal: {
            productId: passport.productId,
            qrIdentityId: (qrIdentityRow.data?.qr_identity_id as string | null) ?? null,
            organizationId: passport.organizationId ?? null,
            scannedAt: scan.timestamp,
            geoCountry: scan.country,
            geoCity: scan.city,
            deviceFingerprint: scan.userAgent,
            scanSource: "public_verify",
          },
        },
      )

      await persistVerificationOutputs(
        {
          supabase: admin,
          organizationId: passport.organizationId ?? null,
          actor: "system",
        },
        passport.productId,
        orchestrator,
      )

      await admin
        .from("products")
        .update({
          risk_score: orchestrator.riskAfter,
          verification_status: orchestrator.status,
        })
        .eq("id", passport.productId)

      await admin.from("scan_events").insert({
        product_id: passport.productId,
        qr_identity_id: (qrIdentityRow.data?.qr_identity_id as string | null) ?? null,
        organization_id: passport.organizationId ?? null,
        scanned_at: scan.timestamp,
        ip_address: scan.ipAddress,
        device_fingerprint: scan.userAgent,
        geo_country: scan.country,
        geo_city: scan.city,
        user_agent: scan.userAgent,
        scan_source: "verify_page",
      })

      const qrIdentityId = qrIdentityRow.data?.qr_identity_id as string | null
      if (qrIdentityId) {
        try {
          await admin.rpc("increment_qr_scan_counter", {
            p_qr_identity_id: qrIdentityId,
            p_scanned_at: scan.timestamp,
          })
        } catch {
          await admin
            .from("qr_identities")
            .update({
              total_scans: fraud.totalScanCount + 1,
              first_scan_at: fraud.totalScanCount === 0 ? scan.timestamp : undefined,
              last_scan_at: scan.timestamp,
              activation_status: "active",
            })
            .eq("id", qrIdentityId)
        }
      }
    } catch (err) {
      log("error", { ...serializeError(err) }, "product.writes.failed")
    }
  }

  // 5) Verification event.
  try {
    await createVerificationEvent({
      passportId: passport.id,
      verificationType: "public_scan",
      status: verdict === "verified" ? "approved" : "pending",
      reviewNotes:
        verdict === "verified"
          ? "Auto-approved by scan pipeline."
          : "Suspicious pattern detected by scan pipeline.",
    })
  } catch (err) {
    log("warn", { ...serializeError(err) }, "verification_event.failed")
  }

  // 6) Suspicious/fraud notification.
  try {
    await notifyOnSuspiciousScan({
      passportSerial: serialId,
      verdict,
      riskScore: fraud.riskScore,
    })
  } catch (err) {
    log("warn", { ...serializeError(err) }, "notification.failed")
  }

  log("info", { verdict, riskScore: fraud.riskScore }, "scan.pipeline.complete")
}
