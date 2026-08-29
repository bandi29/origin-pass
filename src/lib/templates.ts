import type { MaterialRow, TimelineRow } from "@/lib/passport-wizard-schemas"

/**
 * 1-click industry templates for the passport creation wizard.
 * Prefills story / materials / timeline / custom fields — merchants edit after apply.
 */

export const INDUSTRY_TEMPLATE_IDS = [
  "apparel_textiles",
  "artisan_handmade",
  "jewelry_metals",
] as const

export type IndustryTemplateId = (typeof INDUSTRY_TEMPLATE_IDS)[number]

export type IndustryTemplateCustomField = {
  key: string
  label: string
  placeholder: string
  /** Seed value applied into the form (usually empty — labels guide the merchant). */
  defaultValue?: string
}

export type IndustryTemplate = {
  id: IndustryTemplateId
  label: string
  description: string
  /** Suggested product category string for step 1 */
  categoryHint: string
  story: string
  materials: MaterialRow[]
  timeline: TimelineRow[]
  customFields: IndustryTemplateCustomField[]
}

export const INDUSTRY_TEMPLATES: Record<IndustryTemplateId, IndustryTemplate> = {
  apparel_textiles: {
    id: "apparel_textiles",
    label: "Apparel & Textiles",
    description: "Fiber composition, weaving origin, dye certifications, and washing care.",
    categoryHint: "Apparel & textiles",
    story:
      "This garment is produced with documented fiber content and care guidance so customers and regulators can verify composition and origin.",
    materials: [
      { name: "Primary fiber", source: "Weaving country / mill", sustainabilityTag: "Fiber composition" },
      { name: "Secondary fiber (if any)", source: "", sustainabilityTag: "" },
    ],
    timeline: [
      { stepName: "Fiber / yarn sourcing", location: "", date: "" },
      { stepName: "Weaving / knitting", location: "", date: "" },
      { stepName: "Dyeing / finishing", location: "", date: "" },
    ],
    customFields: [
      {
        key: "fiber_composition",
        label: "Fiber composition",
        placeholder: "e.g. 80% organic cotton, 20% recycled polyester",
      },
      {
        key: "weaving_country",
        label: "Weaving country",
        placeholder: "e.g. Portugal",
      },
      {
        key: "dyeing_certifications",
        label: "Dyeing certifications",
        placeholder: "e.g. GOTS, OEKO-TEX Standard 100",
      },
      {
        key: "washing_care",
        label: "Washing care",
        placeholder: "e.g. Cold wash, line dry, iron low",
      },
    ],
  },
  artisan_handmade: {
    id: "artisan_handmade",
    label: "Artisan & Handmade",
    description: "Artisan attribution, material provenance, technique, and care.",
    categoryHint: "Artisan & handmade",
    story:
      "Handcrafted in small batches by named makers. Material provenance and technique are documented for authenticity and care.",
    materials: [
      { name: "Primary material", source: "Provenance / region", sustainabilityTag: "Handcrafted" },
    ],
    timeline: [
      { stepName: "Material preparation", location: "", date: "" },
      { stepName: "Handcrafting", location: "", date: "" },
      { stepName: "Finishing", location: "", date: "" },
    ],
    customFields: [
      {
        key: "artisan_name",
        label: "Artisan name",
        placeholder: "e.g. Elena Rossi",
      },
      {
        key: "material_provenance",
        label: "Material provenance",
        placeholder: "e.g. Vegetable-tanned leather from Tuscany",
      },
      {
        key: "handcrafting_technique",
        label: "Handcrafting technique",
        placeholder: "e.g. Saddle stitching, hand-loomed",
      },
      {
        key: "care_instructions",
        label: "Care instructions",
        placeholder: "e.g. Condition leather twice a year",
      },
    ],
  },
  jewelry_metals: {
    id: "jewelry_metals",
    label: "Jewelry & Metals",
    description: "Metal purity, gemstone sourcing, and recycled content.",
    categoryHint: "Jewelry & metals",
    story:
      "This piece documents metal purity and sourcing so buyers can verify composition and recycled content claims.",
    materials: [
      { name: "Metal", source: "Refinery / supplier", sustainabilityTag: "Purity" },
      { name: "Gemstone (if any)", source: "Origin / cutting house", sustainabilityTag: "" },
    ],
    timeline: [
      { stepName: "Metal refining / alloying", location: "", date: "" },
      { stepName: "Stone setting / finishing", location: "", date: "" },
    ],
    customFields: [
      {
        key: "metal_purity",
        label: "Metal purity",
        placeholder: "e.g. 18K gold (750), 925 sterling silver",
      },
      {
        key: "gemstone_sourcing",
        label: "Gemstone sourcing",
        placeholder: "e.g. Responsibly sourced sapphire, Jaipur",
      },
      {
        key: "recycled_content_pct",
        label: "Recycled % content",
        placeholder: "e.g. 70% recycled gold",
      },
    ],
  },
}

export const INDUSTRY_TEMPLATE_LIST: IndustryTemplate[] = INDUSTRY_TEMPLATE_IDS.map(
  (id) => INDUSTRY_TEMPLATES[id],
)

export function getIndustryTemplate(id: string | null | undefined): IndustryTemplate | null {
  if (!id) return null
  return id in INDUSTRY_TEMPLATES ? INDUSTRY_TEMPLATES[id as IndustryTemplateId] : null
}

/** Build custom-field key → value map from a template (empty strings ready for edit). */
export function emptyCustomFieldsFromTemplate(
  template: IndustryTemplate,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of template.customFields) {
    out[field.key] = field.defaultValue ?? ""
  }
  return out
}
