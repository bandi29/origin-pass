import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  COMPLIANCE_INGESTION_SYSTEM_PROMPT,
  complianceIngestionSchema,
  normalizeRawComplianceExtraction,
  type ComplianceIngestionResult,
} from "./compliance-ingestion-schema"

function requireGeminiKey(): string {
  const k =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  if (!k) throw new Error("GEMINI_API_KEY is not configured")
  return k
}

export const DEFAULT_GEMINI_VISION_MODEL =
  process.env.GEMINI_VISION_MODEL?.trim() || "gemini-1.5-flash"

/**
 * Extract passport-oriented fields using Gemini vision (multimodal).
 */
export async function extractPassportFieldsWithGemini(params: {
  base64: string
  mimeType: string
  model?: string
}): Promise<ComplianceIngestionResult> {
  const apiKey = requireGeminiKey()
  const genAI = new GoogleGenerativeAI(apiKey)
  const modelName = params.model ?? DEFAULT_GEMINI_VISION_MODEL

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: params.mimeType === "application/pdf" ? 4096 : 2048,
      responseMimeType: "application/json",
    },
    systemInstruction: COMPLIANCE_INGESTION_SYSTEM_PROMPT,
  })

  const result = await model.generateContent([
    {
      text: "OriginPass Compliance Engine: classify LEATHER/TEXTILE/WOOD/JEWELRY (output lowercase keys), extract invoice/certificate fields per category, return strict JSON only (native complianceCategory/complianceData shape or { category, extracted_fields, confidence }).",
    },
    {
      inlineData: {
        mimeType: params.mimeType,
        data: params.base64,
      },
    },
  ])

  const text = result.response.text()?.trim()
  if (!text) throw new Error("Empty response from Gemini")

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(text))
  } catch {
    throw new Error("Gemini returned non-JSON")
  }

  const normalized = normalizeRawComplianceExtraction(parsed)
  return complianceIngestionSchema.parse(normalized)
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  }
  return t
}
