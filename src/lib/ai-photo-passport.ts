/**
 * AI Photo → Passport / compliance draft.
 * Re-exports the ingestion engine for ProductForm and CategoryAwareProductForm.
 */

export type {
  ComplianceIngestionResult,
  PassportIngestionResult,
  PhotoPassportExtraction,
} from "@/lib/ingestion/passport-ingestion-schema"
export {
  ingestDocumentImage,
  resolveIngestionProvider,
} from "@/lib/ingestion/engine"

import { ingestDocumentImage } from "@/lib/ingestion/engine"
import type { ComplianceIngestionResult } from "@/lib/ingestion/passport-ingestion-schema"

/** @deprecated Use `ingestDocumentImage` for provider metadata. */
export const PHOTO_PASSPORT_MODEL =
  process.env.GEMINI_VISION_MODEL?.trim() ||
  process.env.OPENAI_VISION_MODEL?.trim() ||
  "gemini-1.5-flash"

/**
 * Vision extraction for a single product document image (invoice, certificate, label).
 */
export async function extractPassportFieldsFromImage(params: {
  base64: string
  mimeType: string
}): Promise<ComplianceIngestionResult> {
  const { result } = await ingestDocumentImage(params)
  return result
}
