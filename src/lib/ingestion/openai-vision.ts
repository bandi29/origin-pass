import { requireOpenAI } from "@/lib/openai-client"
import { callUpstream } from "@/lib/resilience"
import {
  COMPLIANCE_INGESTION_SYSTEM_PROMPT,
  complianceIngestionSchema,
  normalizeRawComplianceExtraction,
  type ComplianceIngestionResult,
} from "./compliance-ingestion-schema"

export const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini"

/**
 * Extract passport-oriented fields using OpenAI vision (fallback when Gemini is not configured).
 */
export async function extractPassportFieldsWithOpenAI(params: {
  base64: string
  mimeType: string
}): Promise<ComplianceIngestionResult> {
  const openai = requireOpenAI()
  const dataUrl = `data:${params.mimeType};base64,${params.base64}`

  // Vision calls are slower (~5–15s) than text. Higher timeout, same retry shape.
  const completion = await callUpstream(
    "openai",
    (signal) =>
      openai.chat.completions.create(
        {
          model: OPENAI_VISION_MODEL,
          temperature: 0.2,
          max_tokens: 1600,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: COMPLIANCE_INGESTION_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "OriginPass Compliance Engine: classify LEATHER/TEXTILE/WOOD/JEWELRY (lowercase keys in output), extract fields, return strict JSON only.",
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl, detail: "high" },
                },
              ],
            },
          ],
        },
        { signal },
      ),
    { timeoutMs: 25_000, attempts: 2 },
  )

  const raw = completion.choices[0]?.message?.content?.trim()
  if (!raw) throw new Error("Empty response from vision model")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Model returned non-JSON")
  }

  const normalized = normalizeRawComplianceExtraction(parsed)
  return complianceIngestionSchema.parse(normalized)
}
