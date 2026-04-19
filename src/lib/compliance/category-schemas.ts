/**
 * Schema registry for dynamic compliance UIs and AI ingestion mapping.
 * Each category (LEATHER, TEXTILE, WOOD, JEWELRY) defines `fields` with labels, input types,
 * and technical tags on {@link SchemaField.complianceTags} (e.g. EUDR-geo, ESPR-material, EUDR-DDS).
 * All values persist in `products.compliance_data` (single JSONB). UI sections are presentational only.
 */

export const CATEGORY_KEYS = ["leather", "textile", "wood", "jewelry"] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

/** Stable ids for strategy switching + AI category mapping */
export const COMPLIANCE_CATEGORY = {
  LEATHER: "leather",
  TEXTILE: "textile",
  WOOD: "wood",
  JEWELRY: "jewelry",
} as const satisfies Record<string, CategoryKey>

export type FieldSection = "basic" | "compliance" | "traceability" | "certifications"

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "date"
  | "boolean"
  | "geo"
  | "url"
  | "documentUrl"

export type SchemaField = {
  key: string
  label: string
  section: FieldSection
  type: FieldType
  required?: boolean
  /** Relative weight for required-field readiness (optional fields excluded from DPP score) */
  weight?: number
  /** Technical / regulator tags (e.g. EUDR-geo, ESPR-material, EUDR-DDS) */
  complianceTags?: string[]
  placeholder?: string
  helpText?: string
  options?: { value: string; label: string }[]
  /** When true, geo field is mandatory for EUDR-style plots */
  eudrGeoRequired?: boolean
}

export type CategorySchema = {
  key: CategoryKey
  label: string
  description: string
  regulations: string[]
  fields: SchemaField[]
}

const geoHelpEudr =
  "EUDR-relevant categories: provide coordinates for the plot, farm, or first placement of relevant commodities where required by your due diligence."

export const categorySchemas: Record<CategoryKey, CategorySchema> = {
  leather: {
    key: "leather",
    label: "Leather goods",
    description: "Footwear, bags, small leather goods — EUDR cattle/leather traceability & ESPR product requirements.",
    regulations: ["EUDR", "ESPR"],
    fields: [
      {
        key: "product_story",
        label: "Product story",
        section: "basic",
        type: "textarea",
        weight: 1,
        complianceTags: ["DPP-narrative"],
        helpText: "Short consumer-facing story; can mirror passport text later.",
      },
      {
        key: "primary_material_descriptor",
        label: "Primary material",
        section: "basic",
        type: "text",
        required: true,
        weight: 2,
        placeholder: "e.g. Full-grain bovine leather",
        complianceTags: ["ESPR-material"],
      },
      {
        key: "eudr_dds_reference",
        label: "EUDR due diligence statement reference",
        section: "compliance",
        type: "text",
        required: true,
        weight: 3,
        complianceTags: ["EUDR-DDS"],
        helpText: "Operator DDS ID / reference as issued in the EUDR system (when applicable).",
      },
      {
        key: "raw_hide_origin_country",
        label: "Raw material origin (country)",
        section: "compliance",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["EUDR-traceability"],
      },
      {
        key: "tanning_site_country",
        label: "Tanning / finishing site country",
        section: "compliance",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["EUDR-traceability"],
      },
      {
        key: "chemical_compliance_summary",
        label: "Chemical / restriction compliance (ESPR)",
        section: "compliance",
        type: "textarea",
        required: true,
        weight: 2,
        complianceTags: ["ESPR-chemicals"],
        helpText: "Summary of REACH / restricted substances alignment for this article.",
      },
      {
        key: "origin_country",
        label: "Declared origin country",
        section: "traceability",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["traceability"],
      },
      {
        key: "origin_geo",
        label: "Origin geo (lat / long)",
        section: "traceability",
        type: "geo",
        required: true,
        eudrGeoRequired: true,
        weight: 3,
        complianceTags: ["EUDR-geo"],
        helpText: geoHelpEudr,
      },
      {
        key: "chain_of_custody_notes",
        label: "Chain of custody notes",
        section: "traceability",
        type: "textarea",
        weight: 1,
        complianceTags: ["traceability"],
      },
      {
        key: "environmental_certificate_url",
        label: "Environmental / audit certificate (URL)",
        section: "certifications",
        type: "documentUrl",
        weight: 1,
        complianceTags: ["audit"],
      },
    ],
  },
  textile: {
    key: "textile",
    label: "Textiles & fashion",
    description: "Garments and fabrics — ESPR fibre disclosure, durability, and microplastics-related data fields.",
    regulations: ["ESPR"],
    fields: [
      {
        key: "fiber_composition",
        label: "Fibre composition (%)",
        section: "basic",
        type: "textarea",
        required: true,
        weight: 3,
        complianceTags: ["ESPR-fibres"],
        helpText: "List fibres with percentages, e.g. Cotton 60%, Polyester 40%.",
      },
      {
        key: "product_story",
        label: "Product story",
        section: "basic",
        type: "textarea",
        weight: 1,
        complianceTags: ["DPP-narrative"],
      },
      {
        key: "durability_class_or_claim",
        label: "Durability / lifespan claim",
        section: "compliance",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["ESPR-durability"],
      },
      {
        key: "recycled_content_percentage",
        label: "Recycled content (%)",
        section: "compliance",
        type: "number",
        weight: 1,
        complianceTags: ["ESPR-circularity"],
      },
      {
        key: "microplastic_release_mitigation",
        label: "Microplastic release mitigation (synthetic textiles)",
        section: "compliance",
        type: "textarea",
        weight: 2,
        complianceTags: ["ESPR-microplastics"],
        helpText: "Describe measures or N/A for natural-only articles.",
      },
      {
        key: "origin_country",
        label: "Manufacturing origin country",
        section: "traceability",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["traceability"],
      },
      {
        key: "origin_geo",
        label: "Facility geo (optional)",
        section: "traceability",
        type: "geo",
        weight: 1,
        complianceTags: ["optional-geo"],
        helpText: "Optional coordinates for main cut-and-sew or dye facility.",
      },
      {
        key: "certification_url",
        label: "Label / standard certificate (URL)",
        section: "certifications",
        type: "documentUrl",
        weight: 1,
        complianceTags: ["certification"],
      },
    ],
  },
  wood: {
    key: "wood",
    label: "Wood / furniture",
    description: "Wooden furniture and articles — EUDR timber traceability and species declaration.",
    regulations: ["EUDR"],
    fields: [
      {
        key: "wood_species",
        label: "Wood species / genus",
        section: "basic",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["EUDR-species"],
      },
      {
        key: "product_story",
        label: "Product story",
        section: "basic",
        type: "textarea",
        weight: 1,
      },
      {
        key: "eudr_dds_reference",
        label: "EUDR DDS reference (timber)",
        section: "compliance",
        type: "text",
        required: true,
        weight: 3,
        complianceTags: ["EUDR-DDS"],
      },
      {
        key: "harvest_country",
        label: "Harvest / first harvest country",
        section: "compliance",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["EUDR-traceability"],
      },
      {
        key: "origin_country",
        label: "Origin country (declared)",
        section: "traceability",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["traceability"],
      },
      {
        key: "origin_geo",
        label: "Harvest / plot geo (lat / long)",
        section: "traceability",
        type: "geo",
        required: true,
        eudrGeoRequired: true,
        weight: 3,
        complianceTags: ["EUDR-geo"],
        helpText: geoHelpEudr,
      },
      {
        key: "fsc_pefc_reference",
        label: "FSC / PEFC chain-of-custody (URL or ID)",
        section: "certifications",
        type: "documentUrl",
        weight: 2,
        complianceTags: ["chain-of-custody"],
      },
    ],
  },
  jewelry: {
    key: "jewelry",
    label: "Jewelry & gems",
    description: "Due diligence on minerals and gems — OECD-style risk mitigation and supplier disclosure.",
    regulations: ["OECD-DD", "Kimberley (diamonds)"],
    fields: [
      {
        key: "materials_disclosure",
        label: "Materials & fineness",
        section: "basic",
        type: "textarea",
        required: true,
        weight: 2,
        complianceTags: ["material-disclosure"],
        helpText: "Metals, plating, stones (synthetic vs natural) at high level.",
      },
      {
        key: "product_story",
        label: "Product story",
        section: "basic",
        type: "textarea",
        weight: 1,
      },
      {
        key: "supplier_due_diligence_summary",
        label: "Supplier due diligence summary",
        section: "compliance",
        type: "textarea",
        required: true,
        weight: 3,
        complianceTags: ["OECD-DD"],
        helpText: "Steps taken to identify and mitigate supply chain risks.",
      },
      {
        key: "conflict_minerals_statement",
        label: "Conflict-affected / high-risk area statement",
        section: "compliance",
        type: "textarea",
        required: true,
        weight: 2,
        complianceTags: ["OECD-DD"],
      },
      {
        key: "kimberley_compliant",
        label: "Kimberley Process (diamonds) — compliant declaration",
        section: "compliance",
        type: "boolean",
        weight: 2,
        complianceTags: ["Kimberley"],
        helpText: "Toggle only if product contains diamonds; otherwise note N/A in materials.",
      },
      {
        key: "origin_country",
        label: "Last manufacturing country",
        section: "traceability",
        type: "text",
        required: true,
        weight: 2,
        complianceTags: ["traceability"],
      },
      {
        key: "origin_geo",
        label: "Workshop / setter geo (optional)",
        section: "traceability",
        type: "geo",
        weight: 1,
        complianceTags: ["optional-geo"],
      },
      {
        key: "audit_report_url",
        label: "Third-party audit / assessment (URL)",
        section: "certifications",
        type: "documentUrl",
        weight: 1,
        complianceTags: ["audit"],
      },
    ],
  },
}

export function getCategorySchema(key: string): CategorySchema | null {
  if (!CATEGORY_KEYS.includes(key as CategoryKey)) return null
  return categorySchemas[key as CategoryKey]
}

export function getCategorySchemaPublicJson(key: string) {
  const s = getCategorySchema(key)
  if (!s) return null
  return {
    key: s.key,
    label: s.label,
    description: s.description,
    regulations: s.regulations,
    fields: s.fields.map((f) => ({
      key: f.key,
      label: f.label,
      section: f.section,
      type: f.type,
      required: Boolean(f.required),
      weight: f.weight ?? 1,
      complianceTags: f.complianceTags,
      placeholder: f.placeholder,
      helpText: f.helpText,
      options: f.options,
      eudrGeoRequired: f.eudrGeoRequired,
    })),
  }
}
