import { processScan } from "@/backend/modules/scans/process-scan"
import type { ScanRequestMetadata } from "@/lib/scan-request-metadata"

/**
 * Fire-and-forget scan telemetry for the public `/scan/[passportId]` capture route.
 * Velocity checks, risk scoring, and passport_scans insert run via processScan → pipeline.
 * Errors are swallowed so the consumer redirect is never affected.
 */
export async function captureScanTelemetryInBackground(input: {
  passportId: string
  metadata: ScanRequestMetadata
}): Promise<void> {
  try {
    await processScan({
      serialId: input.passportId,
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
      city: input.metadata.city,
      country: input.metadata.country,
      region: input.metadata.region,
      locationLabel: input.metadata.locationLabel,
      scanSource: "qr_scan_redirect",
    })
  } catch (err) {
    console.warn(
      "[scan-capture] background telemetry failed:",
      err instanceof Error ? err.message : err,
    )
  }
}
