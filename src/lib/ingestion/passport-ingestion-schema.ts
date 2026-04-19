/**
 * Legacy barrel: vision ingestion uses compliance-first extraction.
 * @see compliance-ingestion-schema.ts
 */
import type { ComplianceIngestionResult } from "./compliance-ingestion-schema"

export type { ComplianceIngestionResult }
export type PassportIngestionResult = ComplianceIngestionResult
export type PhotoPassportExtraction = ComplianceIngestionResult
