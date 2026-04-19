import type { CategoryKey, SchemaField } from "./category-schemas"
import { categorySchemas } from "./category-schemas"
import type { CategoryComplianceStrategy, ComplianceData } from "./category-compliance-strategy"
import { getCategoryComplianceStrategy } from "./category-compliance-strategy"

export type CategoryProductPayload = {
  complianceCategoryKey: CategoryKey
  name: string
  sku?: string | null
  /** All schema-driven fields (single JSONB column in DB) */
  complianceData: ComplianceData
}

export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === "string") return v.trim() === ""
  if (typeof v === "number") return Number.isNaN(v)
  if (typeof v === "boolean") return false
  if (typeof v === "object" && v !== null && "lat" in v && "lng" in v) {
    const g = v as { lat?: unknown; lng?: unknown }
    return g.lat == null || g.lng == null
  }
  return false
}

function getValue(strategy: CategoryComplianceStrategy, field: SchemaField, data: ComplianceData): unknown {
  return strategy.getFieldValue(data, field)
}

/**
 * Registry-driven required-field messages for the active category strategy (LEATHER, TEXTILE, …).
 */
export function getComplianceFieldErrors(
  categoryKey: CategoryKey,
  complianceData: ComplianceData,
): string[] {
  const schema = categorySchemas[categoryKey]
  const strategy = getCategoryComplianceStrategy(categoryKey)
  if (!schema || !strategy) {
    return ["Unknown compliance category"]
  }
  const errors: string[] = []

  for (const field of schema.fields) {
    if (!field.required) continue
    const v = getValue(strategy, field, complianceData)
    if (field.type === "geo" && field.eudrGeoRequired) {
      const geo = strategy.getFieldValue(complianceData, field) as { lat?: number; lng?: number } | null
      if (!geo || geo.lat == null || geo.lng == null) {
        errors.push(`${field.label} is required (latitude and longitude)`)
      }
      continue
    }
    if (isEmpty(v)) {
      errors.push(`${field.label} is required`)
    }
  }

  return errors
}

export function validateCategoryProduct(
  payload: CategoryProductPayload,
): { ok: true } | { ok: false; errors: string[] } {
  const schema = categorySchemas[payload.complianceCategoryKey]
  const strategy = getCategoryComplianceStrategy(payload.complianceCategoryKey)
  if (!schema || !strategy) {
    return { ok: false, errors: ["Unknown compliance category"] }
  }
  const errors: string[] = []
  if (!payload.name?.trim()) errors.push("Product name is required")

  errors.push(...getComplianceFieldErrors(payload.complianceCategoryKey, payload.complianceData))

  return errors.length ? { ok: false, errors } : { ok: true }
}

/**
 * DPP readiness: **required fields only** — weighted completion of required schema fields for the category.
 */
export function computeDppReadinessScore(
  key: CategoryKey,
  complianceData: ComplianceData,
): number {
  const schema = categorySchemas[key]
  const strategy = getCategoryComplianceStrategy(key)
  if (!schema || !strategy) return 0

  let totalWeight = 0
  let completedWeight = 0

  for (const field of schema.fields) {
    if (!field.required) continue
    const w = field.weight ?? 1
    totalWeight += w
    const v = getValue(strategy, field, complianceData)
    let filled = !isEmpty(v)
    if (field.type === "geo" && field.eudrGeoRequired) {
      const geo = strategy.getFieldValue(complianceData, field) as { lat?: number; lng?: number } | null
      filled = Boolean(geo && geo.lat != null && geo.lng != null)
    }
    if (filled) completedWeight += w
  }

  if (totalWeight === 0) return 100
  return Math.round((100 * completedWeight) / totalWeight)
}
