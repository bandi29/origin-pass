import { z } from "zod"
import {
  CATEGORY_KEYS,
  type CategoryKey,
  categorySchemas,
} from "@/lib/compliance/category-schemas"
import type { ComplianceData } from "@/lib/compliance/category-compliance-strategy"

const categoryEnum = z.enum(CATEGORY_KEYS)

/**
 * Vision model output: category first, then category-specific compliance_data keys only.
 * Models may also return legacy `{ category, extracted_fields, confidence: number }`; see {@link normalizeRawComplianceExtraction}.
 */
export const complianceIngestionSchema = z.object({
  complianceCategory: categoryEnum,
  suggestedProductName: z.union([z.string(), z.null()]).optional(),
  /** Flat key/value pairs matching category-schemas field keys for the chosen category */
  complianceData: z.record(z.string(), z.unknown()).default({}),
  documentType: z
    .enum(["invoice", "certificate", "label", "handwritten_card", "other", "unknown"])
    .optional(),
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
  /** 0–1 numeric score (optional; maps to confidence + ai_metadata) */
  confidenceScore: z.number().min(0).max(1).optional(),
  notesFromDocument: z.union([z.string(), z.null()]).optional(),
})

export type ComplianceIngestionResult = z.infer<typeof complianceIngestionSchema>

/** Keys reserved for merge diagnostics (never from schema). */
const RESERVED = new Set(["_merge_note", "_category_conflict_note"])

function fieldKeysForCategory(cat: CategoryKey): Set<string> {
  return new Set(categorySchemas[cat].fields.map((f) => f.key))
}

/**
 * Coerce geo-like values to { lat, lng } | null.
 */
function coerceGeo(v: unknown): { lat: number; lng: number } | null {
  if (v == null) return null
  if (typeof v === "object" && v !== null && "lat" in v && "lng" in v) {
    const lat = Number((v as { lat: unknown }).lat)
    const lng = Number((v as { lng: unknown }).lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }
  return null
}

/**
 * Keep only keys defined for the category; coerce known shapes (geo).
 */
export function filterComplianceDataForCategory(
  category: CategoryKey,
  raw: Record<string, unknown>,
): ComplianceData {
  const allowed = fieldKeysForCategory(category)
  const out: ComplianceData = {}
  for (const [k, v] of Object.entries(raw)) {
    if (RESERVED.has(k)) continue
    if (!allowed.has(k)) continue
    const field = categorySchemas[category].fields.find((f) => f.key === k)
    if (field?.type === "geo") {
      const g = coerceGeo(v)
      if (g) out[k] = g
      continue
    }
    if (field?.type === "boolean") {
      if (typeof v === "boolean") out[k] = v
      else if (v === "true" || v === "yes") out[k] = true
      else if (v === "false" || v === "no") out[k] = false
      continue
    }
    if (field?.type === "number" && v !== "" && v != null) {
      const n = typeof v === "number" ? v : Number(v)
      if (Number.isFinite(n)) out[k] = n
      continue
    }
    if (v === null || v === undefined) continue
    if (typeof v === "string" && v.trim() === "") continue
    out[k] = v
  }
  return out
}

/**
 * Keys in `data` that look filled (for AI trust highlighting).
 */
export function keysWithValues(data: ComplianceData): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(data)) {
    if (RESERVED.has(k)) continue
    if (v == null) continue
    if (typeof v === "string" && !v.trim()) continue
    if (typeof v === "object" && v !== null && "lat" in v && "lng" in v) {
      const g = v as { lat?: unknown; lng?: unknown }
      if (g.lat != null || g.lng != null) keys.push(k)
      continue
    }
    keys.push(k)
  }
  return keys
}

/**
 * Accepts either our native shape or `{ category: "LEATHER"|…, extracted_fields, confidence: number }`
 * and returns an object safe to pass through {@link complianceIngestionSchema}.
 */
export function normalizeRawComplianceExtraction(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed
  const o = parsed as Record<string, unknown>

  if (typeof o.complianceCategory === "string" && o.complianceData != null) {
    return coerceConfidenceNumber(o)
  }

  const catRaw = o.category
  if (typeof catRaw !== "string") return parsed

  const cat = catRaw.trim().toLowerCase()
  if (!CATEGORY_KEYS.includes(cat as CategoryKey)) return parsed

  const ext = (o.extracted_fields ?? o.extractedFields) as Record<string, unknown> | undefined
  const complianceData: Record<string, unknown> = ext ? { ...ext } : {}

  if (cat === "leather") {
    if (complianceData.primary_material != null && complianceData.primary_material_descriptor == null) {
      complianceData.primary_material_descriptor = complianceData.primary_material
      delete complianceData.primary_material
    }
    if (complianceData.tannery_name != null) {
      const t = String(complianceData.tannery_name).trim()
      const prev = complianceData.chain_of_custody_notes
      complianceData.chain_of_custody_notes = prev
        ? `${String(prev)}\nTannery (from document): ${t}`
        : `Tannery (from document): ${t}`
      delete complianceData.tannery_name
    }
    if (complianceData.cattle_or_hide_reference != null) {
      const h = String(complianceData.cattle_or_hide_reference).trim()
      const prev = complianceData.chain_of_custody_notes
      complianceData.chain_of_custody_notes = prev
        ? `${String(prev)}\nCattle/hide reference (EUDR): ${h}`
        : `Cattle/hide reference (EUDR): ${h}`
      delete complianceData.cattle_or_hide_reference
    }
  }

  if (cat === "textile") {
    if (complianceData.material_percent != null && complianceData.fiber_composition == null) {
      complianceData.fiber_composition = String(complianceData.material_percent)
      delete complianceData.material_percent
    }
    if (complianceData.primary_material != null && complianceData.fiber_composition == null) {
      complianceData.fiber_composition = String(complianceData.primary_material)
      delete complianceData.primary_material
    }
    if (complianceData.manufacturer != null) {
      const m = String(complianceData.manufacturer).trim()
      const prev = complianceData.product_story
      complianceData.product_story = prev
        ? `${String(prev)}\nManufacturer (from document): ${m}`
        : `Manufacturer (from document): ${m}`
      delete complianceData.manufacturer
    }
  }

  const c = o.confidence
  let confidence: "high" | "medium" | "low" = "medium"
  let confidenceScore: number | undefined
  if (typeof c === "number" && !Number.isNaN(c)) {
    confidenceScore = Math.min(1, Math.max(0, c))
    confidence = confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.55 ? "medium" : "low"
  } else if (c === "high" || c === "medium" || c === "low") {
    confidence = c
  }

  return {
    complianceCategory: cat,
    complianceData,
    suggestedProductName: o.suggestedProductName ?? null,
    documentType: o.documentType,
    confidence,
    confidenceScore,
    notesFromDocument: o.notesFromDocument ?? null,
  }
}

function coerceConfidenceNumber(o: Record<string, unknown>): Record<string, unknown> {
  const c = o.confidence
  const cs = o.confidenceScore
  if (typeof c === "number" && !Number.isNaN(c)) {
    const confidenceScore = Math.min(1, Math.max(0, c))
    const confidence: "high" | "medium" | "low" =
      confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.55 ? "medium" : "low"
    return { ...o, confidence, confidenceScore }
  }
  if (typeof cs === "number" && !Number.isNaN(cs) && (c === undefined || c === null)) {
    const confidenceScore = Math.min(1, Math.max(0, cs))
    const conf: "high" | "medium" | "low" =
      confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.55 ? "medium" : "low"
    return { ...o, confidence: conf, confidenceScore }
  }
  return o
}

function buildFieldCatalogForPrompt(): string {
  const lines: string[] = []
  for (const cat of CATEGORY_KEYS) {
    const fields = categorySchemas[cat].fields.map((f) => {
      let hint = f.type
      if (f.type === "geo") hint += ' — JSON shape {"lat": number, "lng": number} or null'
      return `    - "${f.key}" (${hint})`
    })
    lines.push(`  "${cat}":\n${fields.join("\n")}`)
  }
  return lines.join("\n\n")
}

export const COMPLIANCE_INGESTION_JSON_INSTRUCTIONS = `You are the OriginPass Compliance Engine. Analyze the uploaded document (invoice, certificate, label, or similar).

CLASSIFY (required): Decide if the item is LEATHER, TEXTILE, WOOD, or JEWELRY (conceptually). Output the key as lowercase: "leather" | "textile" | "wood" | "jewelry" in field complianceCategory.

EXTRACT (category-specific hints — map into complianceData using the exact registry keys in the catalog below):
- LEATHER: Look for tannery name, country of origin, cattle/hide or lot references relevant to EUDR; map tannery to tanning_site_country when it is a country/location, else put tannery wording in chain_of_custody_notes. Map material lines to primary_material_descriptor. Map origin lines to origin_country and/or raw_hide_origin_country as appropriate. EUDR DDS or due diligence references → eudr_dds_reference when present.
- TEXTILE: Look for material composition with percentages (e.g. 100% Cotton), manufacturer or mill name; map composition to fiber_composition; put manufacturer in product_story if no dedicated field matches.
- WOOD: Species, harvest/origin, EUDR DDS references, geo when stated.
- JEWELRY: Materials disclosure, due diligence, origin.

OUTPUT — return ONE strict JSON object. Prefer this native shape:
- complianceCategory (string): "leather" | "textile" | "wood" | "jewelry"
- complianceData (object): ONLY keys from the catalog for that category. Use exact snake_case keys.
- suggestedProductName (string|null)
- documentType (optional): "invoice"|"certificate"|"label"|"handwritten_card"|"other"|"unknown"
- confidence: "high"|"medium"|"low" OR confidence as a number from 0 to 1 (e.g. 0.95). If you use a number, still set qualitative confidence if possible.
- confidenceScore (optional): number 0–1 — overall extraction confidence (you may duplicate numeric confidence here).
- notesFromDocument (string|null)

Alternate shape (also accepted): { "category": "LEATHER", "extracted_fields": { ... }, "confidence": 0.95 } with uppercase category and flat extracted_fields; keys may use aliases like primary_material or tannery_name — the engine will map them.

Per-category allowed keys:

${buildFieldCatalogForPrompt()}

Rules:
1) Classify first, then extract only that category's keys.
2) For origin_geo use {"lat": number, "lng": number} when coordinates appear or are clearly inferable.
3) Do not invent SKUs, prices, or batch numbers not on the document.
4) If text is illegible, omit fields and lower confidence / confidenceScore.`

export const COMPLIANCE_INGESTION_SYSTEM_PROMPT = `OriginPass Compliance Engine — document vision for EU Digital Product Passport (DPP) readiness.

You analyze invoices, certificates, and compliance paperwork. You classify into LEATHER / TEXTILE / WOOD / JEWELRY (output lowercase keys as specified) and extract structured fields for compliance_data JSONB storage.

${COMPLIANCE_INGESTION_JSON_INSTRUCTIONS}`

/**
 * Merge multiple single-document extractions into one draft.
 * Primary category is the first document; only files with the same category contribute fields (later wins).
 */
export function mergeComplianceExtractions(
  results: ComplianceIngestionResult[],
): ComplianceIngestionResult & { aiFilledKeys: string[] } {
  if (results.length === 0) {
    throw new Error("mergeComplianceExtractions: empty results")
  }
  const primaryCategory = results[0].complianceCategory
  let merged: ComplianceData = {}
  const aiFilledKeysSet = new Set<string>()
  const conflictNotes: string[] = []

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.complianceCategory !== primaryCategory) {
      conflictNotes.push(
        `File ${i + 1} classified as "${r.complianceCategory}" (primary is "${primaryCategory}"); its fields were not merged.`,
      )
      continue
    }
    const filtered = filterComplianceDataForCategory(primaryCategory, r.complianceData)
    for (const k of keysWithValues(filtered)) {
      aiFilledKeysSet.add(k)
    }
    merged = { ...merged, ...filtered }
  }

  const suggested =
    results.map((r) => r.suggestedProductName?.trim()).find(Boolean) ?? null
  const docNotes = results.map((r) => r.notesFromDocument?.trim()).filter(Boolean)
  const combinedNotes =
    [...docNotes, ...conflictNotes].join("\n---\n") || null

  const scoreVals = results
    .map((r) => r.confidenceScore)
    .filter((n): n is number => typeof n === "number" && !Number.isNaN(n))
  const confidenceScoreAvg =
    scoreVals.length > 0
      ? Math.round((scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length) * 100) / 100
      : undefined

  const qual = results.some((r) => r.confidence === "high")
    ? "high"
    : results.some((r) => r.confidence === "medium")
      ? "medium"
      : "low"

  return {
    complianceCategory: primaryCategory,
    suggestedProductName: suggested,
    complianceData: merged as Record<string, unknown>,
    documentType: results[results.length - 1]?.documentType,
    confidence: qual,
    ...(confidenceScoreAvg != null ? { confidenceScore: confidenceScoreAvg } : {}),
    notesFromDocument: combinedNotes || null,
    aiFilledKeys: [...aiFilledKeysSet],
  }
}
