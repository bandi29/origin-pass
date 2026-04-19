/**
 * Strategy pattern: each compliance category resolves field read/write against
 * a single `compliance_data` JSONB object (flat keys + `origin_geo` object for lat/lng).
 */

import type { CategoryKey, CategorySchema, SchemaField } from "./category-schemas"
import { categorySchemas } from "./category-schemas"

export type ComplianceData = Record<string, unknown>

export interface CategoryComplianceStrategy {
  readonly key: CategoryKey
  readonly schema: CategorySchema
  getFieldValue(data: ComplianceData, field: SchemaField): unknown
  /** Immutable update */
  setFieldValue(data: ComplianceData, field: SchemaField, value: unknown): ComplianceData
}

function getGeo(data: ComplianceData, fieldKey: string): { lat?: number; lng?: number } | null {
  const raw = data[fieldKey]
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const lat = typeof o.lat === "number" ? o.lat : parseFloat(String(o.lat ?? ""))
  const lng = typeof o.lng === "number" ? o.lng : parseFloat(String(o.lng ?? ""))
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

function createStrategy(key: CategoryKey): CategoryComplianceStrategy {
  const schema = categorySchemas[key]

  return {
    key,
    schema,

    getFieldValue(data: ComplianceData, field: SchemaField): unknown {
      if (field.type === "geo") {
        return getGeo(data, field.key)
      }
      return data[field.key]
    },

    setFieldValue(data: ComplianceData, field: SchemaField, value: unknown): ComplianceData {
      if (field.type === "geo") {
        if (value === null || value === undefined) {
          const next = { ...data }
          delete next[field.key]
          return next
        }
        if (typeof value === "object" && value !== null && "lat" in value && "lng" in value) {
          const v = value as { lat: number; lng: number }
          return { ...data, [field.key]: { lat: v.lat, lng: v.lng } }
        }
        return data
      }
      return { ...data, [field.key]: value }
    },
  }
}

const cache = new Map<CategoryKey, CategoryComplianceStrategy>()

export function getCategoryComplianceStrategy(key: CategoryKey | ""): CategoryComplianceStrategy | null {
  if (!key) return null
  let s = cache.get(key)
  if (!s) {
    s = createStrategy(key)
    cache.set(key, s)
  }
  return s
}
