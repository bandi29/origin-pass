import { normalizeGtinDigits, validateGTIN } from "@/lib/gs1"

/** Weighted EU ESPR readiness criteria (sum = 100). */
export const COMPLIANCE_WEIGHTS = {
  gtin: 25,
  origin: 20,
  materials: 25,
  care: 15,
  documents: 15,
} as const

export type ComplianceTier = "Non-Compliant" | "Basic" | "EU Export Ready"

export type ComplianceRiskLabel =
  | "High EU Border Risk"
  | "Partial Compliance - Missing Fields"
  | "EU ESPR Export Ready"

export type ComplianceMissingItemId =
  | "gtin"
  | "origin"
  | "materials"
  | "care"
  | "documents"

export type ComplianceMissingItem = {
  id: ComplianceMissingItemId
  label: string
  /** In-page anchor for the Product Passport Editor section. */
  anchor: string
  weight: number
}

export type CompliancePassportInput = {
  /** Catalog-level GTIN (fallback when variants lack GTINs). */
  productGtin?: string | null
  /** Per-variant GTINs (any valid mapped GTIN satisfies the criterion). */
  variantGtins?: Array<string | null | undefined> | null
  /** Country / place of origin (product override or brand default). */
  countryOfOrigin?: string | null
  /** Material / fiber composition disclosure. */
  materialComposition?: string | null
  /** Care, repair, or recycling instructions. */
  careInstructions?: string | null
  /** At least one compliance PDF (product or brand evidence). */
  hasComplianceDocument?: boolean | null
}

export type ComplianceScoreResult = {
  score: number
  tier: ComplianceTier
  riskLabel: ComplianceRiskLabel
  missingItems: ComplianceMissingItem[]
  /** Which weighted criteria are currently satisfied. */
  satisfied: Record<ComplianceMissingItemId, boolean>
}

const MISSING_COPY: Record<
  ComplianceMissingItemId,
  { label: string; anchor: string }
> = {
  gtin: {
    label: "Map a valid product or variant GTIN (EAN/UPC)",
    anchor: "#eu-score-gtin",
  },
  origin: {
    label: "Define country / place of origin",
    anchor: "#eu-score-origin",
  },
  materials: {
    label: "Add material composition",
    anchor: "#eu-score-materials",
  },
  care: {
    label: "Add care, repair, or recycling instructions",
    anchor: "#eu-score-care",
  },
  documents: {
    label: "Attach at least one compliance document (PDF)",
    anchor: "#eu-score-docs",
  },
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasMappedGtin(input: CompliancePassportInput): boolean {
  const product = normalizeGtinDigits(input.productGtin ?? "")
  if (product && validateGTIN(product)) return true
  for (const raw of input.variantGtins ?? []) {
    const digits = normalizeGtinDigits(raw ?? "")
    if (digits && validateGTIN(digits)) return true
  }
  return false
}

export function complianceTierForScore(score: number): ComplianceTier {
  if (score >= 86) return "EU Export Ready"
  if (score >= 50) return "Basic"
  return "Non-Compliant"
}

export function complianceRiskLabelForScore(score: number): ComplianceRiskLabel {
  if (score >= 86) return "EU ESPR Export Ready"
  if (score >= 50) return "Partial Compliance - Missing Fields"
  return "High EU Border Risk"
}

/**
 * Pure EU ESPR readiness score from passport editor fields.
 * Returns 0-100, tier, risk badge label, and missing mandatory items.
 */
export function calculateComplianceScore(
  passportData: CompliancePassportInput,
): ComplianceScoreResult {
  const satisfied: Record<ComplianceMissingItemId, boolean> = {
    gtin: hasMappedGtin(passportData),
    origin: hasText(passportData.countryOfOrigin),
    materials: hasText(passportData.materialComposition),
    care: hasText(passportData.careInstructions),
    documents: Boolean(passportData.hasComplianceDocument),
  }

  let score = 0
  const missingItems: ComplianceMissingItem[] = []

  for (const id of Object.keys(COMPLIANCE_WEIGHTS) as ComplianceMissingItemId[]) {
    const weight = COMPLIANCE_WEIGHTS[id]
    if (satisfied[id]) {
      score += weight
    } else {
      const copy = MISSING_COPY[id]
      missingItems.push({
        id,
        label: copy.label,
        anchor: copy.anchor,
        weight,
      })
    }
  }

  return {
    score,
    tier: complianceTierForScore(score),
    riskLabel: complianceRiskLabelForScore(score),
    missingItems,
    satisfied,
  }
}
