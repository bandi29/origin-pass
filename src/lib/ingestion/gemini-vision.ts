import { GoogleGenerativeAI } from "@google/generative-ai"
import { z } from "zod"
import { resolveGeminiApiKey, resolveGeminiVisionModel } from "@/lib/env-local-file"
import {
  COMPLIANCE_INGESTION_SYSTEM_PROMPT,
  complianceIngestionSchema,
  normalizeRawComplianceExtraction,
  type ComplianceIngestionResult,
} from "./compliance-ingestion-schema"

function requireGeminiKey(): string {
  const k = resolveGeminiApiKey()
  if (!k) {
    throw new Error(
      "Gemini API key is not configured (set GEMINI_API_KEY, GOOGLE_AI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY)",
    )
  }
  return k
}

function extractErrorMessage(e: unknown): string {
  return e instanceof Error
    ? e.message
    : typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e)
}

/** Key / project misconfiguration — retrying other models will not help. */
function isHardAuthOrKeyError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes("api_key_invalid") ||
    m.includes("api key not valid") ||
    m.includes("invalid api key") ||
    m.includes("permission_denied") ||
    m.includes("request had invalid authentication") ||
    m.includes("unauthenticated") ||
    (m.includes("403") && m.includes("permission"))
  )
}

/** Model id not available for this account / region. */
function isRetryableModelNameError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes("404") ||
    m.includes("not found") ||
    m.includes("not_found") ||
    m.includes("invalid model") ||
    m.includes("does not exist") ||
    (m.includes("model") && m.includes("not available")) ||
    (m.includes("unsupported") && m.includes("model")) ||
    m.includes("unknown model")
  )
}

/** Prefer these when sorting IDs returned from ListModels (first match wins conceptually). */
const MODEL_TRIES_PREFERENCE = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-flash",
]

let listModelsCache: { apiKey: string; ids: string[] } | null = null

/**
 * Ask Google which model names support `generateContent` for this API key (avoids hard-coded 404s like gemini-1.5-flash-8b).
 */
async function fetchGenerableGeminiModelIds(apiKey: string): Promise<string[]> {
  if (listModelsCache?.apiKey === apiKey) return listModelsCache.ids
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    const r = await fetch(url, { method: "GET", cache: "no-store" })
    if (!r.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[gemini-vision] ListModels failed:", r.status, await r.text().catch(() => ""))
      }
      listModelsCache = { apiKey, ids: [] }
      return []
    }
    const data = (await r.json()) as {
      models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
    }
    const raw =
      data.models
        ?.filter((m) => {
          const n = m.name.toLowerCase()
          if (!m.supportedGenerationMethods?.includes("generateContent")) return false
          if (n.includes("embedding")) return false
          return true
        })
        .map((m) => m.name.replace(/^models\//, ""))
        .filter(Boolean) ?? []

    const preferredRank = (id: string) => {
      const i = MODEL_TRIES_PREFERENCE.indexOf(id)
      return i === -1 ? 999 : i
    }
    raw.sort((a, b) => {
      const d = preferredRank(a) - preferredRank(b)
      if (d !== 0) return d
      const fa = a.includes("flash") ? 0 : 1
      const fb = b.includes("flash") ? 0 : 1
      if (fa !== fb) return fa - fb
      return a.localeCompare(b)
    })

    listModelsCache = { apiKey, ids: raw }
    if (process.env.NODE_ENV === "development" && raw.length) {
      console.info("[gemini-vision] ListModels:", raw.slice(0, 12).join(", "), raw.length > 12 ? "…" : "")
    }
    return raw
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[gemini-vision] ListModels error:", e)
    }
    listModelsCache = { apiKey, ids: [] }
    return []
  }
}

/** Static fallbacks if a name is missing from ListModels; keep short — many ids 404 on v1beta. */
const STATIC_MODEL_FALLBACKS = ["gemini-2.0-flash", "gemini-1.5-flash"]

async function buildVisionModelCandidates(apiKey: string, primary: string): Promise<string[]> {
  const fromApi = await fetchGenerableGeminiModelIds(apiKey)
  const seen = new Set<string>()
  const out: string[] = []
  const add = (id: string) => {
    const s = id.trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    out.push(s)
  }
  add(primary)
  for (const id of fromApi) add(id)
  for (const id of STATIC_MODEL_FALLBACKS) add(id)
  return out.slice(0, 14)
}

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
  const primary = params.model ?? resolveGeminiVisionModel()
  const candidates = await buildVisionModelCandidates(apiKey, primary)

  const userParts = [
    {
      text: "OriginPass Compliance Engine: classify LEATHER/TEXTILE/WOOD/JEWELRY (output lowercase keys), extract invoice/certificate fields per category, return strict JSON only (native complianceCategory/complianceData shape or { category, extracted_fields, confidence }).",
    },
    {
      inlineData: {
        mimeType: params.mimeType,
        data: params.base64,
      },
    },
  ]

  type GenResult = Awaited<
    ReturnType<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]>
  >
  let result: GenResult | undefined = undefined
  let lastMsg = ""
  let usedModel = primary

  outer: for (let mi = 0; mi < candidates.length; mi++) {
    const modelName = candidates[mi]
    usedModel = modelName
    const isLastModel = mi === candidates.length - 1

    for (const useJsonMime of [true, false]) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: params.mimeType === "application/pdf" ? 4096 : 2048,
          ...(useJsonMime ? { responseMimeType: "application/json" as const } : {}),
        },
        systemInstruction: COMPLIANCE_INGESTION_SYSTEM_PROMPT,
      })

      try {
        if (process.env.NODE_ENV === "development") {
          console.info(`[gemini-vision] ${modelName} jsonMime=${useJsonMime}`)
        }
        result = await model.generateContent(userParts)
        break outer
      } catch (e) {
        lastMsg = extractErrorMessage(e)
        if (isHardAuthOrKeyError(lastMsg)) {
          throw new Error(`Gemini API request failed: ${lastMsg}`)
        }
        // Bad model id: skip straight to next model (no point retrying without JSON on same id).
        if (useJsonMime && isRetryableModelNameError(lastMsg)) {
          if (!isLastModel && process.env.NODE_ENV === "development") {
            console.warn(
              `[gemini-vision] model "${modelName}" unavailable (${lastMsg.slice(0, 160)}), next model`,
            )
          }
          if (!isLastModel) continue outer
          throw new Error(`Gemini API request failed: ${lastMsg}`)
        }
        // First attempt uses JSON output mode; many PDF / multimodal calls fail that — always try plain text second.
        if (useJsonMime) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[gemini-vision] ${modelName} with JSON output failed, retrying without responseMimeType — ${lastMsg.slice(0, 200)}`,
            )
          }
          continue
        }
        if (!isLastModel) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[gemini-vision] model "${modelName}" failed (${lastMsg.slice(0, 160)}), trying next model`,
            )
          }
          continue outer
        }
        throw new Error(`Gemini API request failed: ${lastMsg}`)
      }
    }
  }

  if (result === undefined) {
    throw new Error(`Gemini API request failed: ${lastMsg || "no model succeeded"}`)
  }

  const text = result.response.text()?.trim()
  if (!text) throw new Error(`Empty response from Gemini (model ${usedModel})`)

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(text))
  } catch {
    throw new Error("Gemini returned non-JSON")
  }

  const normalized = normalizeRawComplianceExtraction(parsed)
  try {
    return complianceIngestionSchema.parse(normalized)
  } catch (e) {
    if (e instanceof z.ZodError) {
      const summary = e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      throw new Error(`Extraction validation failed: ${summary}`)
    }
    throw e
  }
}

function stripJsonFence(s: string): string {
  const t = s.trim()
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  }
  return t
}
