import { filterComplianceDataForCategory } from "./compliance-ingestion-schema"
import type { ComplianceIngestionResult } from "./compliance-ingestion-schema"
import { extractPassportFieldsWithGemini } from "./gemini-vision"
import { extractPassportFieldsWithOpenAI } from "./openai-vision"

export type IngestionProvider = "gemini" | "openai"

export type { ComplianceIngestionResult } from "./compliance-ingestion-schema"

function hasGeminiKey(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_AI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  )
}

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

/**
 * Resolves which vision backend is available. Prefer Gemini 1.5 Flash when API key is present.
 */
export function resolveIngestionProvider(): IngestionProvider | null {
  if (hasGeminiKey()) return "gemini"
  if (hasOpenAIKey()) return "openai"
  return null
}

/**
 * Ingestion Engine: document image → structured passport draft fields.
 * Primary: Gemini 1.5 Flash (configurable via GEMINI_VISION_MODEL).
 * Fallback: OpenAI vision (OPENAI_VISION_MODEL / gpt-4o-mini).
 */
export async function ingestDocumentImage(params: {
  base64: string
  mimeType: string
}): Promise<{ provider: IngestionProvider; result: ComplianceIngestionResult }> {
  const provider = resolveIngestionProvider()
  if (!provider) {
    throw new Error(
      "No AI vision provider configured. Set GEMINI_API_KEY (recommended) or OPENAI_API_KEY.",
    )
  }

  if (params.mimeType === "application/pdf" && provider !== "gemini") {
    throw new Error(
      "PDF_DOCUMENTS_REQUIRE_GEMINI: Configure GEMINI_API_KEY to process PDF documents. OpenAI vision in this app accepts images only.",
    )
  }

  if (provider === "gemini") {
    const result = await extractPassportFieldsWithGemini(params)
    return { provider: "gemini", result: normalizeComplianceIngestion(result) }
  }

  const result = await extractPassportFieldsWithOpenAI(params)
  return { provider: "openai", result: normalizeComplianceIngestion(result) }
}

function normalizeComplianceIngestion(r: ComplianceIngestionResult): ComplianceIngestionResult {
  const complianceData = filterComplianceDataForCategory(
    r.complianceCategory,
    r.complianceData as Record<string, unknown>,
  )
  return {
    ...r,
    complianceData: complianceData as Record<string, unknown>,
  }
}
