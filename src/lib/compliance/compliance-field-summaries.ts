import type { CategoryKey } from "@/lib/compliance/category-schemas"
import type { ComplianceData } from "@/lib/compliance/category-compliance-strategy"

export function summarizeOrigin(c: ComplianceData): string {
  const country = String(c.origin_country ?? "").trim()
  const geo = c.origin_geo as { lat?: number; lng?: number } | undefined
  const geoStr =
    geo && typeof geo.lat === "number" && typeof geo.lng === "number"
      ? ` [${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}]`
      : ""
  return `${country}${geoStr}`.trim()
}

export function summarizeMaterials(key: CategoryKey, c: ComplianceData): string {
  if (key === "textile") return String(c.fiber_composition ?? "")
  if (key === "wood") return String(c.wood_species ?? "")
  if (key === "jewelry") return String(c.materials_disclosure ?? "")
  return String(c.primary_material_descriptor ?? c.product_story ?? "")
}
