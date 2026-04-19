import { Country, State } from "country-state-city"
import type { CategoryKey } from "@/lib/compliance/category-schemas"
import {
  type ComplianceIngestionResult,
  filterComplianceDataForCategory,
} from "@/lib/ingestion/compliance-ingestion-schema"
import type { ProductFormDraft } from "@/lib/product-form-draft"

const SORTER = new Intl.Collator("en", { sensitivity: "base" })

/** Materials shown as quick-select chips in ProductForm */
export const COMMON_MATERIALS_FOR_MATCH = [
  "Leather",
  "Cotton",
  "Wool",
  "Silk",
  "Linen",
  "Metal",
  "Brass",
  "Wood",
  "Bamboo",
  "Recycled materials",
  "Organic cotton",
  "Vegetable-tanned leather",
] as const

function bestCommonMaterialMatch(materialText: string): string | null {
  const t = materialText.trim().toLowerCase()
  if (!t) return null
  let best: { tag: string; score: number } | null = null
  for (const tag of COMMON_MATERIALS_FOR_MATCH) {
    const tl = tag.toLowerCase()
    if (t === tl) return tag
    if (t.includes(tl) || tl.includes(t)) {
      const score = Math.min(t.length, tl.length)
      if (!best || score > best.score) best = { tag, score }
    }
  }
  return best?.tag ?? null
}

/**
 * Match trailing country name in freeform origin strings (e.g. "Tuscany, Italy" → Italy).
 */
export function parseOriginForForm(originRaw: string | null | undefined): {
  originCountry: string
  originState: string
  originCity: string
  originOther: string
} {
  const empty = {
    originCountry: "",
    originState: "",
    originCity: "",
    originOther: "",
  }
  if (!originRaw?.trim()) return empty

  const origin = originRaw.trim()
  const countries = Country.getAllCountries().sort(
    (a, b) => b.name.length - a.name.length
  )

  for (const c of countries) {
    const idx = origin.toLowerCase().lastIndexOf(c.name.toLowerCase())
    if (idx === -1) continue
    const before = origin.slice(0, idx).replace(/[,\s]+$/, "").trim()
    const states = State.getStatesOfCountry(c.isoCode)
    let stateName = ""
    let cityPart = before
    if (before.includes(",")) {
      const parts = before.split(",").map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 2) {
        const maybeState = parts[parts.length - 1]
        const matchState = states.find(
          (s) => SORTER.compare(s.name, maybeState) === 0
        )
        if (matchState) {
          stateName = matchState.name
          cityPart = parts.slice(0, -1).join(", ")
        } else {
          cityPart = before
        }
      } else {
        cityPart = before
      }
    }

    return {
      originCountry: c.name,
      originState: stateName,
      originCity: cityPart || "",
      originOther: "",
    }
  }

  return {
    originCountry: "Other",
    originState: "",
    originCity: "",
    originOther: origin,
  }
}

function materialLineForCategory(cat: CategoryKey, d: Record<string, unknown>): string {
  if (cat === "leather") return String(d.primary_material_descriptor ?? "")
  if (cat === "textile") return String(d.fiber_composition ?? "")
  if (cat === "wood") return String(d.wood_species ?? "")
  if (cat === "jewelry") return String(d.materials_disclosure ?? "")
  return ""
}

function originLineForCategory(cat: CategoryKey, d: Record<string, unknown>): string | null {
  const o = String(d.origin_country ?? "").trim()
  if (o) return o
  if (cat === "leather") {
    const h = String(d.raw_hide_origin_country ?? "").trim()
    if (h) return h
  }
  if (cat === "wood") {
    const h = String(d.harvest_country ?? "").trim()
    if (h) return h
  }
  return null
}

/**
 * Maps compliance-first vision extraction into the legacy ProductForm draft (Details accordion).
 */
export function complianceIngestionToLegacyProductFormDraft(
  extraction: ComplianceIngestionResult,
  existing: Partial<ProductFormDraft>,
): ProductFormDraft {
  const cat = extraction.complianceCategory
  const d = filterComplianceDataForCategory(cat, extraction.complianceData as Record<string, unknown>)

  const mat = materialLineForCategory(cat, d).trim()
  const matched = mat ? bestCommonMaterialMatch(mat) : null
  const selectedMaterials = [...(existing.selectedMaterials ?? [])]
  if (matched && !selectedMaterials.includes(matched)) {
    selectedMaterials.push(matched)
  }
  let materialsOther = existing.materialsOther ?? ""
  if (mat && !matched) {
    materialsOther = materialsOther ? `${materialsOther}; ${mat}` : mat
  }

  const originRaw = originLineForCategory(cat, d)
  const parsedOrigin = parseOriginForForm(originRaw)
  const hasExistingOrigin =
    !!(existing.originCountry?.trim() ||
      existing.originState?.trim() ||
      existing.originCity?.trim() ||
      existing.originOther?.trim())
  const origin = hasExistingOrigin
    ? {
        originCountry: existing.originCountry ?? "",
        originState: existing.originState ?? "",
        originCity: existing.originCity ?? "",
        originOther: existing.originOther ?? "",
      }
    : parsedOrigin

  const storyBits: string[] = []
  const ps = String(d.product_story ?? "").trim()
  if (ps) storyBits.push(ps)
  const notes = extraction.notesFromDocument?.trim()
  if (notes) storyBits.push(`Notes (from document): ${notes}`)

  if (cat === "leather") {
    const chem = String(d.chemical_compliance_summary ?? "").trim()
    if (chem) storyBits.push(`Chemical / restriction compliance (from document): ${chem}`)
    const coc = String(d.chain_of_custody_notes ?? "").trim()
    if (coc) storyBits.push(`Chain of custody (from document): ${coc}`)
    const eudr = String(d.eudr_dds_reference ?? "").trim()
    if (eudr) storyBits.push(`EUDR DDS reference (from document): ${eudr}`)
  }
  if (cat === "wood") {
    const eudr = String(d.eudr_dds_reference ?? "").trim()
    if (eudr) storyBits.push(`EUDR DDS (timber, from document): ${eudr}`)
  }
  if (cat === "textile") {
    const dur = String(d.durability_class_or_claim ?? "").trim()
    if (dur) storyBits.push(`Durability (from document): ${dur}`)
  }
  if (cat === "jewelry") {
    const dd = String(d.supplier_due_diligence_summary ?? "").trim()
    if (dd) storyBits.push(`Due diligence (from document): ${dd}`)
  }

  const docType =
    extraction.documentType && extraction.documentType !== "unknown"
      ? `Document type (detected): ${extraction.documentType.replace(/_/g, " ")}.`
      : ""
  if (docType) storyBits.push(docType)

  const storyBase = (existing.story ?? "").trim()
  const storyAugment = storyBits.join("\n\n")
  const story = storyAugment
    ? storyBase
      ? `${storyBase}\n\n${storyAugment}`
      : storyAugment
    : storyBase

  const suggested = extraction.suggestedProductName?.trim()
  const finalName = existing.productName?.trim() || suggested || ""

  return {
    productName: finalName,
    story: story || storyBase,
    selectedMaterials,
    materialsOther,
    originCountry: origin.originCountry || existing.originCountry || "",
    originState: origin.originState || existing.originState || "",
    originCity: origin.originCity || existing.originCity || "",
    originOther: origin.originOther || existing.originOther || "",
    repairable: existing.repairable ?? "",
    lifespan: existing.lifespan ?? "",
    recyclable: existing.recyclable ?? "",
    imageUrl: existing.imageUrl ?? "",
  }
}
