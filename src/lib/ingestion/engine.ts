import { resolveGeminiApiKey, resolveOpenaiApiKey } from "@/lib/env-local-file"
import { filterComplianceDataForCategory } from "./compliance-ingestion-schema"
import type { ComplianceIngestionResult } from "./compliance-ingestion-schema"
import { extractPassportFieldsWithGemini } from "./gemini-vision"
import { extractPassportFieldsWithOpenAI } from "./openai-vision"
import { rememberAi } from "@/lib/ai-cache"
import { createHash } from "node:crypto"

export type IngestionProvider = "gemini" | "openai"

export type { ComplianceIngestionResult } from "./compliance-ingestion-schema"

/**
 * Resolves which vision backend is available. Prefer Gemini 1.5 Flash when API key is present.
 */
export function resolveIngestionProvider(): IngestionProvider | null {
  if (resolveGeminiApiKey()) return "gemini"
  if (resolveOpenaiApiKey()) return "openai"
  return null
}

/**
 * Ingestion Engine: document image → structured passport draft fields.
 * Primary: Gemini 1.5 Flash (configurable via GEMINI_VISION_MODEL).
 * Fallback: OpenAI vision (OPENAI_VISION_MODEL / gpt-4o-mini).
 *
 * Vision calls are the most expensive AI in the app (~$0.01–0.05 per image).
 * Identical image bytes → identical extraction, so we cache by SHA-256 of the
 * raw image content + provider + mime type. Re-uploading the same document
 * (common during multi-step product creation) is a Redis hit.
 */
export async function ingestDocumentImage(params: {
  base64: string
  mimeType: string
  skipCache?: boolean
}): Promise<{ provider: IngestionProvider; result: ComplianceIngestionResult; cacheHit: boolean }> {
  const provider = resolveIngestionProvider()
  if (!provider) {
    throw new Error(
      "No AI vision provider configured. Set GEMINI_API_KEY, GOOGLE_AI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY (Gemini), or OPENAI_API_KEY (images only).",
    )
  }

  if (params.mimeType === "application/pdf" && provider !== "gemini") {
    throw new Error(
      "PDF_DOCUMENTS_REQUIRE_GEMINI: Configure GEMINI_API_KEY, GOOGLE_AI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY to process PDF documents. OpenAI vision in this app accepts images only.",
    )
  }

  // Image-content hash. We don't pass the base64 string through `stableStringify`
  // — that would build a megabyte-scale canonical string just to hash. Instead
  // we pre-hash the decoded bytes and pass the digest into the cache key.
  const imageHash = createHash("sha256").update(params.base64, "base64").digest("hex")
  const cacheInput = {
    imageHash,
    mimeType: params.mimeType,
    provider,
  }

  const { value, hit } = await rememberAi<{ provider: IngestionProvider; result: ComplianceIngestionResult }>(
    "photo-passport:v1",
    cacheInput,
    async () => {
      if (provider === "gemini") {
        const r = await extractPassportFieldsWithGemini(params)
        return { provider: "gemini", result: normalizeComplianceIngestion(r) }
      }
      const r = await extractPassportFieldsWithOpenAI(params)
      return { provider: "openai", result: normalizeComplianceIngestion(r) }
    },
    { skipCache: params.skipCache },
  )

  return { ...value, cacheHit: hit }
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
