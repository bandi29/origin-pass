/**
 * ESPR / GPSR export readiness scorecard (merchant-facing).
 *
 * Weighting (sum = 100):
 *   - Mandatory (+50): materials, country of origin, GTIN or SKU
 *   - GPSR (+25): EU responsible person + safety warnings
 *   - Enhanced (+25): recycled content, care instructions, certifications/docs
 */

import { normalizeGtinDigits, validateGTIN } from "@/lib/gs1"
import type { GpsrData } from "@/lib/passport-wizard-schemas"

export type EsprScoreStatus = "Compliant" | "Warning" | "Incomplete"

export type EsprMissingField = {
  id: string
  label: string
  group: "mandatory" | "gpsr" | "enhanced"
  /** Dashboard deep-link (relative). */
  href: string
}

export type EsprComplianceInput = {
  materialComposition?: string | null
  countryOfOrigin?: string | null
  gtin?: string | null
  sku?: string | null
  gpsr?: GpsrData | null
  recycledContentPct?: string | number | null
  careInstructions?: string | null
  hasCertificationsOrDocuments?: boolean | null
  /** Used to build fix links. */
  passportId?: string | null
  productId?: string | null
}

export type EsprComplianceResult = {
  score: number
  status: EsprScoreStatus
  missingFields: EsprMissingField[]
  completedFields: string[]
  breakdown: {
    mandatory: number
    gpsr: number
    enhanced: number
  }
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasGtinOrSku(input: EsprComplianceInput): boolean {
  const gtin = normalizeGtinDigits(input.gtin ?? "")
  if (gtin && validateGTIN(gtin)) return true
  return hasText(input.sku)
}

function hasEuResponsiblePerson(gpsr: GpsrData | null | undefined): boolean {
  const p = gpsr?.euResponsiblePerson
  if (!p) return false
  return (
    hasText(p.name) ||
    hasText(p.company) ||
    hasText(p.email) ||
    hasText(p.address) ||
    hasText(p.phone)
  )
}

function hasSafetyWarnings(gpsr: GpsrData | null | undefined): boolean {
  return (gpsr?.safetyInformation ?? []).some((w) => hasText(w))
}

function hasRecycledContent(value: string | number | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0
  return hasText(value == null ? "" : String(value))
}

function fixHref(input: EsprComplianceInput, tab: "content" | "edit"): string {
  if (input.passportId) {
    return tab === "edit"
      ? `/dashboard/product-passports/${input.passportId}/edit`
      : `/dashboard/product-passports/${input.passportId}?tab=content`
  }
  if (input.productId) {
    return `/dashboard/products/passport-wizard?step=2&productId=${input.productId}`
  }
  return "/dashboard/product-passports"
}

export function esprStatusForScore(score: number): EsprScoreStatus {
  if (score >= 90) return "Compliant"
  if (score >= 55) return "Warning"
  return "Incomplete"
}

/**
 * Compute ESPR export readiness from passport / product fields.
 */
export function computeEsprComplianceScore(input: EsprComplianceInput): EsprComplianceResult {
  const missingFields: EsprMissingField[] = []
  const completedFields: string[] = []
  const editHref = fixHref(input, "edit")

  // —— Mandatory (50) — three equal slices ≈ 16.67 each, rounded to sum 50
  const mandatoryChecks: Array<{
    id: string
    label: string
    ok: boolean
    points: number
  }> = [
    {
      id: "materials",
      label: "Material composition",
      ok: hasText(input.materialComposition),
      points: 17,
    },
    {
      id: "origin",
      label: "Country of origin",
      ok: hasText(input.countryOfOrigin),
      points: 17,
    },
    {
      id: "gtin_sku",
      label: "GTIN or SKU",
      ok: hasGtinOrSku(input),
      points: 16,
    },
  ]

  let mandatory = 0
  for (const c of mandatoryChecks) {
    if (c.ok) {
      mandatory += c.points
      completedFields.push(c.label)
    } else {
      missingFields.push({
        id: c.id,
        label: c.label,
        group: "mandatory",
        href: editHref,
      })
    }
  }

  // —— GPSR (25) — responsible person 15 + safety warnings 10
  let gpsrPts = 0
  if (hasEuResponsiblePerson(input.gpsr)) {
    gpsrPts += 15
    completedFields.push("EU responsible person")
  } else {
    missingFields.push({
      id: "eu_responsible_person",
      label: "EU responsible person",
      group: "gpsr",
      href: editHref,
    })
  }
  if (hasSafetyWarnings(input.gpsr)) {
    gpsrPts += 10
    completedFields.push("Safety warnings")
  } else {
    missingFields.push({
      id: "safety_warnings",
      label: "Safety warnings / hazard information",
      group: "gpsr",
      href: editHref,
    })
  }

  // —— Enhanced (25) — recycled 8 + care 9 + docs 8
  let enhanced = 0
  if (hasRecycledContent(input.recycledContentPct)) {
    enhanced += 8
    completedFields.push("Recycled content")
  } else {
    missingFields.push({
      id: "recycled_content",
      label: "Recycled content %",
      group: "enhanced",
      href: editHref,
    })
  }
  if (hasText(input.careInstructions)) {
    enhanced += 9
    completedFields.push("Care instructions")
  } else {
    missingFields.push({
      id: "care",
      label: "Care instructions",
      group: "enhanced",
      href: editHref,
    })
  }
  if (input.hasCertificationsOrDocuments) {
    enhanced += 8
    completedFields.push("Certifications / documents")
  } else {
    missingFields.push({
      id: "documents",
      label: "Certifications or compliance documents",
      group: "enhanced",
      href: editHref,
    })
  }

  const score = Math.min(100, mandatory + gpsrPts + enhanced)
  return {
    score,
    status: esprStatusForScore(score),
    missingFields,
    completedFields,
    breakdown: { mandatory, gpsr: gpsrPts, enhanced },
  }
}

/** @deprecated Prefer computeEsprComplianceScore — kept for import alias clarity. */
export const calculateEsprComplianceScore = computeEsprComplianceScore
