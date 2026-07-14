import { VERIFICATION_FIELD_KEYS, type VerificationFieldKey } from "@/lib/verification-field-keys"
import type { DataProvenance } from "@/lib/evidence-scope"
import { fieldInheritsBrandDefault } from "@/lib/field-lineage"

export type ProductComplianceData = {
  production_location?: string | null
  care_instructions?: string | null
  production_location_proof_url?: string | null
  care_instructions_proof_url?: string | null
}

const FIELD_TO_COMPLIANCE_KEY: Record<
  typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
  keyof ProductComplianceData
> = {
  [VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION]: "production_location",
  [VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS]: "care_instructions",
}

export function parseProductComplianceData(raw: unknown): ProductComplianceData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const row = raw as Record<string, unknown>
  return {
    production_location:
      typeof row.production_location === "string" ? row.production_location.trim() || null : null,
    care_instructions:
      typeof row.care_instructions === "string" ? row.care_instructions.trim() || null : null,
    production_location_proof_url:
      typeof row.production_location_proof_url === "string"
        ? row.production_location_proof_url.trim() || null
        : null,
    care_instructions_proof_url:
      typeof row.care_instructions_proof_url === "string"
        ? row.care_instructions_proof_url.trim() || null
        : null,
  }
}

export function readProductComplianceField(
  complianceData: unknown,
  fieldKey: typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
): string | null {
  const parsed = parseProductComplianceData(complianceData)
  return parsed[FIELD_TO_COMPLIANCE_KEY[fieldKey]] ?? null
}

/** Whether the displayed claim for this field comes from the product record or brand default. */
export function fieldClaimProvenance(
  fieldKey: typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
  complianceData: unknown,
  brandDefault?: string | null,
): DataProvenance {
  const value = readProductComplianceField(complianceData, fieldKey)
  return fieldInheritsBrandDefault(value, brandDefault) ? "fallback" : "record"
}

export function resolvedFieldDisplayValue(
  fieldKey: typeof VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION | typeof VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS,
  complianceData: unknown,
  brandFallback: string | null | undefined,
): string | null {
  const productValue = readProductComplianceField(complianceData, fieldKey)
  if (productValue) return productValue
  const fallback = brandFallback?.trim()
  return fallback || null
}

export function mergeProductComplianceField(
  existing: unknown,
  fieldKey: VerificationFieldKey,
  value: string,
): ProductComplianceData {
  const parsed = parseProductComplianceData(existing)
  if (fieldKey === VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION) {
    parsed.production_location = value.trim() || null
  } else if (fieldKey === VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS) {
    parsed.care_instructions = value.trim() || null
  }
  return parsed
}
