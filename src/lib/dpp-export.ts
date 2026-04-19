/**
 * EU Digital Product Passport (DPP) / ESPR 2026 Export
 * Maps OriginPass database schema to JSON-LD format for traceability compliance.
 * Uses schema.org types and GS1-compatible data model.
 */

export interface MaterialCompositionEntry {
  material: string
  percentage: number
}

export interface BatchExportData {
  batch: {
    id: string
    production_run_name: string | null
    artisan_name: string | null
    location: string | null
    produced_at: string | null
    material_composition: MaterialCompositionEntry[] | null
    maintenance_instructions: string | null
    end_of_life_instructions: string | null
    facility_info: string | null
  }
  product: {
    id: string
    name: string
    story: string | null
    materials: string | null
    origin: string | null
    lifecycle: string | null
    image_url: string | null
  }
  brand: {
    id: string
    brand_name: string | null
  }
  items: Array<{
    id: string
    serial_id: string
  }>
}

export interface DPPJsonLd {
  "@context": string[]
  "@type": string[]
  "@id"?: string
  uniqueProductIdentifier: string
  name: string
  description?: string
  materialComposition: MaterialCompositionEntry[]
  facilityIdentifier: string
  circularityInfo: {
    careInstructions?: string
    repairInstructions?: string
    endOfLifeInstructions?: string
  }
  productOrigin?: string
  productionDate?: string
  brand?: {
    "@type": string
    name: string
  }
  image?: string
}

/**
 * Maps a single item (serial number) to ESPR 2026-compliant JSON-LD structure.
 */
export function mapItemToJsonLd(
  item: { id: string; serial_id: string },
  batchData: BatchExportData,
  baseUrl: string
): DPPJsonLd {
  const { batch, product, brand } = batchData

  // GS1 Digital Link URI: Our traceable verification URL serves as the unique product identifier
  const uniqueProductIdentifier = `${baseUrl.replace(/\/$/, "")}/verify/${item.serial_id}`

  // Material composition from batch (ESPR mandatory)
  const materialComposition: MaterialCompositionEntry[] =
    Array.isArray(batch.material_composition) && batch.material_composition.length > 0
      ? batch.material_composition
      : product.materials
        ? [{ material: product.materials, percentage: 100 }]
        : []

  // Facility identifier: workshop/studio ID or location (ESPR mandatory)
  const facilityIdentifier =
    batch.facility_info || batch.location || batch.artisan_name || "Unknown facility"

  // Circularity: care, repair, end-of-life (ESPR mandatory)
  const circularityInfo = {
    careInstructions: batch.maintenance_instructions || undefined,
    repairInstructions: batch.maintenance_instructions || undefined,
    endOfLifeInstructions: batch.end_of_life_instructions || undefined,
  }

  const jsonLd: DPPJsonLd = {
    "@context": [
      "https://schema.org",
      "https://ref.gs1.org/standards/gs1-digital-link",
    ],
    "@type": ["Product", "DigitalProductPassport"],
    "@id": uniqueProductIdentifier,
    uniqueProductIdentifier,
    name: product.name,
    description: product.story || undefined,
    materialComposition,
    facilityIdentifier,
    circularityInfo,
    productOrigin: product.origin || undefined,
    productionDate: batch.produced_at
      ? new Date(batch.produced_at).toISOString().split("T")[0]
      : undefined,
    brand: brand.brand_name
      ? { "@type": "Brand", name: brand.brand_name }
      : undefined,
    image: product.image_url || undefined,
  }

  return jsonLd
}

export interface ExportManifest {
  "@context": "https://schema.org"
  "@type": "DataExport"
  brandIdentity: {
    name: string
    id: string
  }
  exportDate: string
  batchId: string
  batchName: string
  productName: string
  itemCount: number
  standard: "EU ESPR 2026 Digital Product Passport"
  format: "JSON-LD"
}

/**
 * Product-level JSON-LD for EU DPP compliance.
 * Stored in backend for future-proofing against shifting regulations.
 */
export interface ProductJsonLd {
  "@context": string[]
  "@type": string[]
  name: string
  description?: string
  materialComposition: MaterialCompositionEntry[]
  productOrigin?: string
  image?: string
  brand?: { "@type": string; name: string }
  lifecycle?: string
}

/**
 * Builds standardized JSON-LD for a product (stored in backend).
 */
export function buildProductJsonLd(params: {
  name: string
  story: string | null
  materials: string | null
  origin: string | null
  lifecycle: string | null
  imageUrl: string | null
  brandName: string | null
}): ProductJsonLd {
  const { name, story, materials, origin, lifecycle, imageUrl, brandName } = params

  const materialComposition: MaterialCompositionEntry[] =
    materials && materials.trim()
      ? materials
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean)
          .map((material) => ({ material, percentage: 0 }))
          .map((entry, i, arr) => ({
            ...entry,
            percentage: arr.length > 0 ? Math.round(100 / arr.length) : 0,
          }))
      : []

  if (materialComposition.length > 1) {
    const total = materialComposition.reduce((s, e) => s + e.percentage, 0)
    if (total !== 100 && materialComposition.length > 0) {
      materialComposition[0].percentage += 100 - total
    }
  }

  return {
    "@context": [
      "https://schema.org",
      "https://ref.gs1.org/standards/gs1-digital-link",
    ],
    "@type": ["Product"],
    name,
    description: story || undefined,
    materialComposition,
    productOrigin: origin || undefined,
    image: imageUrl || undefined,
    brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
    lifecycle: lifecycle || undefined,
  }
}

/**
 * Builds the manifest.json for the export archive (audit purposes).
 */
export function buildManifest(
  batchData: BatchExportData,
  exportDate: Date = new Date()
): ExportManifest {
  return {
    "@context": "https://schema.org",
    "@type": "DataExport",
    brandIdentity: {
      name: batchData.brand.brand_name || "Unknown Brand",
      id: batchData.brand.id,
    },
    exportDate: exportDate.toISOString(),
    batchId: batchData.batch.id,
    batchName: batchData.batch.production_run_name || "Production Batch",
    productName: batchData.product.name,
    itemCount: batchData.items.length,
    standard: "EU ESPR 2026 Digital Product Passport",
    format: "JSON-LD",
  }
}
