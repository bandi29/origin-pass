import {
  fieldLineageChip,
  resolveFieldLineage,
  resolveFieldLineageState,
  type FieldLineageInput,
  type FieldLineageState,
} from "@/lib/field-lineage"

/** @deprecated Use FieldLineageState from field-lineage.ts */
export type MerchantFieldEvidenceState = FieldLineageState

export function resolveMerchantFieldEvidenceState(options: FieldLineageInput): FieldLineageState {
  return resolveFieldLineageState(options)
}

export {
  fieldLineageChip,
  resolveFieldLineage,
  resolveFieldLineageState,
  type FieldLineageState,
}

export const FIELD_LINEAGE_FIELD_LABELS = {
  productionLocation: "Origin",
  careInstructions: "Care",
} as const
