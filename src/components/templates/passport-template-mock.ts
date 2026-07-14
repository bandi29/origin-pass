import type { PassportThemeProps } from "@/components/templates/passport-theme-types"

/** Demo data for template preview (leather goods example). */
export const PASSPORT_TEMPLATE_PREVIEW_MOCK: PassportThemeProps = {
  qrToken: "preview-demo",
  displayId: "OP-PREVIEW-DEMO",
  passportId: "00000000-0000-0000-0000-000000000001",
  brandName: "Atelier North",
  productData: {
    name: "Heritage Leather Weekender",
    description:
      "Hand-cut full-grain vegetable-tanned leather, stitched in small batches. Designed to develop a rich patina over years of travel.",
    category: "Leather goods",
    story: null,
    materials: null,
    origin: "Tuscany, Italy",
    image_url: null,
    brand_id: null,
    metadata: null,
  },
  batchData: {
    production_run_name: "Spring Atelier Run",
    artisan_name: "Elena Rossi",
    location: "Florence",
    produced_at: "2026-04-01",
  },
  storyText:
    "Each bag is cut from a single hide, edge-painted by hand, and fitted with solid brass hardware sourced within 200 km of our workshop.",
  structuredMaterials: [
    { name: "Full-grain leather", source: "Tuscany tannery", sustainabilityTag: "Vegetable tanned" },
    { name: "Brass hardware", source: "Prato", sustainabilityTag: "Recyclable" },
  ],
  timelineSteps: [
    { stepName: "Cut & skive", location: "Florence", date: "2026-03-15" },
    { stepName: "Assembly", location: "Florence", date: "2026-03-28" },
  ],
}
