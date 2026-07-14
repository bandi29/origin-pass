/**
 * Merchant-facing lineage for a passport field.
 * - inherited: effective value equals the brand default (or no product value stored)
 * - overridden: effective value differs from brand default and product evidence exists
 * - conflict: effective value differs from brand default without product evidence
 */
export type FieldLineageState = "inherited" | "overridden" | "conflict"

export type FieldLineageInput = {
  /** Stored or in-progress product value (empty = inherit brand default). */
  productValue: string | null | undefined
  brandDefault: string | null | undefined
  productCertPresent: boolean
  brandCertPresent: boolean
}

/** Normalize for comparison — lineage is driven by effective value, not override toggles. */
export function normalizeFieldValue(value: string | null | undefined): string {
  return (value ?? "").trim()
}

/** True when the product effectively inherits the brand default for this field. */
export function fieldInheritsBrandDefault(
  productValue: string | null | undefined,
  brandDefault: string | null | undefined,
): boolean {
  const product = normalizeFieldValue(productValue)
  if (!product) return true
  const brand = normalizeFieldValue(brandDefault)
  if (!brand) return false
  return product === brand
}

export function fieldValueDiffersFromBrandDefault(
  productValue: string | null | undefined,
  brandDefault: string | null | undefined,
): boolean {
  return !fieldInheritsBrandDefault(productValue, brandDefault)
}

/**
 * Single source of truth for field lineage across editor, product list, and public passport.
 */
export function resolveFieldLineageState(input: FieldLineageInput): FieldLineageState {
  if (fieldInheritsBrandDefault(input.productValue, input.brandDefault)) {
    return "inherited"
  }
  if (input.productCertPresent) return "overridden"
  return "conflict"
}

export type FieldLineageResolution = FieldLineageInput & {
  state: FieldLineageState
  chip: FieldLineageChipModel
  inheritsBrandDefault: boolean
  valueDiffersFromBrand: boolean
  isUnverifiedClaim: boolean
  isAuditReady: boolean
}

/** Resolve lineage state plus merchant chip metadata in one call. */
export function resolveFieldLineage(input: FieldLineageInput): FieldLineageResolution {
  const inheritsBrandDefault = fieldInheritsBrandDefault(input.productValue, input.brandDefault)
  const valueDiffersFromBrand = !inheritsBrandDefault
  const state = resolveFieldLineageState(input)
  return {
    ...input,
    state,
    inheritsBrandDefault,
    valueDiffersFromBrand,
    chip: fieldLineageChip(state, input.brandCertPresent),
    isUnverifiedClaim: state === "conflict",
    isAuditReady: isFieldAuditReady(state, input.brandCertPresent),
  }
}

export function isFieldAuditReady(state: FieldLineageState, brandCertPresent: boolean): boolean {
  if (state === "overridden") return true
  if (state === "inherited") return brandCertPresent
  return false
}

export type FieldLineageChipModel = {
  label: string
  tone: "inherited" | "overridden" | "conflict" | "inherited-muted"
}

export function fieldLineageChip(
  state: FieldLineageState,
  brandCertPresent: boolean,
): FieldLineageChipModel {
  if (state === "overridden") {
    return { label: "Product-specific ✓", tone: "overridden" }
  }
  if (state === "conflict") {
    return { label: "⚠ Unverified claim", tone: "conflict" }
  }
  if (brandCertPresent) {
    return { label: "Inherited ✓", tone: "inherited" }
  }
  return { label: "Inherited", tone: "inherited-muted" }
}

/** Persist empty compliance_data when the value matches brand default. */
export function normalizedProductFieldStorageValue(
  productValue: string | null | undefined,
  brandDefault: string | null | undefined,
): string {
  if (fieldInheritsBrandDefault(productValue, brandDefault)) return ""
  return normalizeFieldValue(productValue)
}

export type ProductFieldLineage = {
  productionLocation: FieldLineageState
  careInstructions: FieldLineageState
  brandCerts: {
    productionLocation: boolean
    careInstructions: boolean
  }
}

export function productHasConflict(lineage: ProductFieldLineage): boolean {
  return lineage.productionLocation === "conflict" || lineage.careInstructions === "conflict"
}

export function productIsAuditReady(lineage: ProductFieldLineage): boolean {
  return (
    isFieldAuditReady(lineage.productionLocation, lineage.brandCerts.productionLocation) &&
    isFieldAuditReady(lineage.careInstructions, lineage.brandCerts.careInstructions)
  )
}

export type BrandDefaultCoverage = {
  total: number
  productionInherited: number
  careInherited: number
}

export function computeBrandDefaultCoverage(
  products: Array<{
    lineage: Pick<ProductFieldLineage, "productionLocation" | "careInstructions">
  }>,
): BrandDefaultCoverage {
  return {
    total: products.length,
    productionInherited: products.filter((p) => p.lineage.productionLocation === "inherited").length,
    careInherited: products.filter((p) => p.lineage.careInstructions === "inherited").length,
  }
}

export type ComplianceHealthSummary = {
  total: number
  auditReady: number
  needAttention: number
  /** Neither conflicted nor audit-ready — inheriting defaults that lack evidence. */
  awaitingEvidence: number
}

export function computeComplianceHealth(
  products: Array<{ lineage: ProductFieldLineage }>,
): ComplianceHealthSummary {
  const total = products.length
  let auditReady = 0
  let needAttention = 0
  for (const product of products) {
    if (productHasConflict(product.lineage)) needAttention += 1
    else if (productIsAuditReady(product.lineage)) auditReady += 1
  }
  // Every product lands in exactly one bucket, so the summary can never read
  // "0 audit-ready · 0 need attention" while products silently lack evidence.
  return { total, auditReady, needAttention, awaitingEvidence: total - auditReady - needAttention }
}
