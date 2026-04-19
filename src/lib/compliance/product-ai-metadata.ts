/**
 * Persisted on `products.ai_metadata` (JSONB) for audit / immutable event streams.
 */
export type AiSourceFileRef = {
  url: string
  mime_type: string
  original_name?: string
}

export type ProductAiMetadata = {
  /** Model-reported extraction confidence */
  extraction_confidence?: "high" | "medium" | "low"
  /** 0–1 when the model returns a numeric score */
  extraction_confidence_score?: number
  /** Vision backend used for the run */
  provider?: "gemini" | "openai"
  /** ISO 8601 when extraction completed */
  extracted_at?: string
  /** Public (or app-resolvable) URLs of uploaded source documents */
  source_files?: AiSourceFileRef[]
  /** Optional: count of files processed in one batch */
  files_processed?: number
}
