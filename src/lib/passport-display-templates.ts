export const PASSPORT_TEMPLATE_KEYS = ["classic", "luxury"] as const
export type PassportTemplateKey = (typeof PASSPORT_TEMPLATE_KEYS)[number]

export function normalizePassportTemplateKey(value: string | null | undefined): PassportTemplateKey {
  const v = (value ?? "classic").toLowerCase().trim()
  if (v === "luxury") return "luxury"
  return "classic"
}

export function resolvePassportTemplateKey(
  productTemplate: string | null | undefined,
  brandTemplate: string | null | undefined,
): PassportTemplateKey {
  if (productTemplate != null && String(productTemplate).trim() !== "") {
    return normalizePassportTemplateKey(productTemplate)
  }
  return normalizePassportTemplateKey(brandTemplate)
}

export const PASSPORT_TEMPLATES: {
  key: PassportTemplateKey
  title: string
  description: string
  successLabel: string
}[] = [
  {
    key: "classic",
    title: "Classic",
    description: "Bright, trustworthy layout with emerald accents—ideal for everyday goods.",
    successLabel: "Classic Template applied successfully!",
  },
  {
    key: "luxury",
    title: "Luxury",
    description: "Rich dark palette with gold highlights—suited to premium positioning.",
    successLabel: "Luxury Template applied successfully!",
  },
]
