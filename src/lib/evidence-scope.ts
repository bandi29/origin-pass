/** Whether displayed claim data comes from the product record or brand-wide defaults. */
export type DataProvenance = "record" | "fallback"

/** Whether attached evidence is scoped to the product or the brand (store-global). */
export type EvidenceScope = "product" | "brand" | "none"

export type DataProvenanceModel = {
  provenance: DataProvenance
  label: string
  helper: string
  /** Shopper-facing wording. "Using fallback" is ops jargon a QR scanner can't parse. */
  publicLabel: string
  publicHelper: string
}

export type EvidenceScopeModel = {
  scope: EvidenceScope
  label: string
  helper: string
  /** Brand evidence must not be presented as product proof when data is record-level. */
  mismatchedWithData: boolean
  /** Shopper-facing wording — see DataProvenanceModel.publicLabel. */
  publicLabel: string
}

export function dataProvenanceForPassport(options: {
  hasRecordLevelData: boolean
}): DataProvenanceModel {
  if (options.hasRecordLevelData) {
    return {
      provenance: "record",
      label: "Record-level data",
      helper: "This product has its own compliance values — not only brand defaults.",
      publicLabel: "Product-specific data",
      publicHelper: "These details were recorded for this individual product.",
    }
  }
  return {
    provenance: "fallback",
    label: "Using fallback",
    helper: "This product relies on brand-wide defaults until record-level data is added.",
    publicLabel: "Brand-wide data",
    publicHelper: "These details apply to the brand's whole range, not this item alone.",
  }
}

export function evidenceScopeForField(options: {
  productCertPresent: boolean
  brandCertPresent: boolean
  dataProvenance: DataProvenance
}): EvidenceScopeModel {
  if (options.productCertPresent) {
    return {
      scope: "product",
      label: "Verified for this product",
      helper: "Supporting documentation is attached to this product.",
      mismatchedWithData: false,
      publicLabel: "Specific to this item",
    }
  }

  if (options.brandCertPresent) {
    const mismatchedWithData = options.dataProvenance === "record"
    return {
      scope: "brand",
      label: "Brand-level evidence",
      helper: mismatchedWithData
        ? "This document supports the brand default — it does not verify this product's own record."
        : "This document supports the brand-wide default shown when a product has no record of its own.",
      mismatchedWithData,
      publicLabel: "Covers the brand's range",
    }
  }

  return {
    scope: "none",
    label: "No evidence on file",
    helper: "No supporting documentation is attached for this claim.",
    mismatchedWithData: false,
    publicLabel: "No document",
  }
}

/** Field-level data provenance on the public passport. */
export function fieldDataProvenance(
  fieldKey: string,
  options: {
    passportUsesRecordFields?: boolean
    /** Per-field claim provenance when known (production/care from compliance_data). */
    fieldClaimProvenance?: DataProvenance
  },
): DataProvenance {
  if (options.fieldClaimProvenance) return options.fieldClaimProvenance
  if (fieldKey === "production_location" || fieldKey === "care_instructions") {
    return "fallback"
  }
  return options.passportUsesRecordFields ? "record" : "fallback"
}
