/**
 * HTTP-facing GS1 Digital Link classification used by `/01/[...gs1Path]`
 * and scenario tests (GS1-01 ... GS1-05).
 */

import { isValidUuid } from "@/lib/security"
import {
  normalizeGtinDigits,
  parseGS1DigitalLinkPath,
  validateGTIN,
  type GS1DigitalLinkParts,
} from "@/lib/gs1"
import {
  resolveGs1DigitalLinkPath,
  type Gs1ResolvedProduct,
} from "@/lib/gs1-passport-resolve"

export const GS1_INVALID_STRUCTURE_MESSAGE = "Invalid GS1 Identifier Structure"
export const GS1_NOT_FOUND_MESSAGE =
  "No active passport exists for this product identifier."

export type Gs1HttpClassification =
  | { kind: "invalid_structure"; message: string; parts: GS1DigitalLinkParts | null }
  | { kind: "not_found"; message: string; parts: GS1DigitalLinkParts | null }
  | { kind: "ok"; product: Gs1ResolvedProduct; parts: GS1DigitalLinkParts | null }

/** True when Accept prefers machine-readable GS1 / JSON payloads. */
export function wantsGs1MachinePayload(accept: string | null): boolean {
  if (!accept) return false
  const lower = accept.toLowerCase()
  return lower.includes("application/ld+json") || lower.includes("application/json")
}

/**
 * Detect malformed GTIN AI values (wrong length, non-numeric, bad check digit).
 * UUID-shaped first segments are allowed as hybrid id fallback (not "malformed GTIN").
 */
export function isMalformedGtinIdentifier(rawGtin: string): boolean {
  const trimmed = String(rawGtin ?? "").trim()
  if (!trimmed) return true
  if (isValidUuid(trimmed)) return false
  const digits = normalizeGtinDigits(trimmed)
  // Non-numeric garbage (e.g. "abc") after stripping ? malformed
  if (!digits) return true
  // Numeric but not a legal GTIN length / check digit
  return !validateGTIN(digits)
}

/**
 * Classify a `/01/...` path before responding (400 vs 404 vs success).
 */
export async function classifyGs1DigitalLinkRequest(
  pathSegments: string[],
): Promise<Gs1HttpClassification> {
  const segments = Array.isArray(pathSegments) ? pathSegments : []
  const parts = parseGS1DigitalLinkPath(segments)
  const rawFirst =
    segments[0] === "01" || segments[0] === "gtin"
      ? String(segments[1] ?? "").trim()
      : String(segments[0] ?? "").trim()

  if (!rawFirst) {
    return {
      kind: "invalid_structure",
      message: GS1_INVALID_STRUCTURE_MESSAGE,
      parts,
    }
  }

  // Hybrid: UUID product id in the GTIN slot is not a malformed GTIN.
  if (!isValidUuid(rawFirst) && isMalformedGtinIdentifier(rawFirst)) {
    return {
      kind: "invalid_structure",
      message: GS1_INVALID_STRUCTURE_MESSAGE,
      parts,
    }
  }

  const product = await resolveGs1DigitalLinkPath(segments)
  if (!product) {
    return {
      kind: "not_found",
      message: GS1_NOT_FOUND_MESSAGE,
      parts,
    }
  }

  return { kind: "ok", product, parts }
}

/**
 * Public HTML target for a resolved GS1 link.
 * Variant matches append `?variant={external_variant_id}` (consumed by `/sp` loader).
 */
export function publicPassportTargetPath(product: Gs1ResolvedProduct): string | null {
  if (product.shopSlug && product.externalProductId) {
    let path = `/sp/${encodeURIComponent(product.shopSlug)}/${encodeURIComponent(product.externalProductId)}`
    if (product.externalVariantId) {
      path += `?variant=${encodeURIComponent(product.externalVariantId)}`
    }
    return path
  }
  if (product.serial) {
    return `/p/${encodeURIComponent(product.serial)}`
  }
  if (product.passportToken) {
    return `/p/${encodeURIComponent(product.passportToken)}`
  }
  return null
}

export function invalidStructureHtml(message = GS1_INVALID_STRUCTURE_MESSAGE): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invalid GS1 Identifier - OriginPass</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; min-height: 100vh;
      display: grid; place-items: center; background: #f6f6f7; color: #202223; }
    main { max-width: 28rem; padding: 2rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { margin: 0; color: #6d7175; line-height: 1.5; font-size: 0.95rem; }
  </style>
</head>
<body>
  <main>
    <h1>${message}</h1>
    <p>The Digital Link GTIN is missing, non-numeric, or has an invalid length / check digit.</p>
  </main>
</body>
</html>`
}

export function notFoundPassportHtml(message = GS1_NOT_FOUND_MESSAGE): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Passport not found - OriginPass</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; min-height: 100vh;
      display: grid; place-items: center; background: #f6f6f7; color: #202223; }
    main { max-width: 28rem; padding: 2rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { margin: 0; color: #6d7175; line-height: 1.5; font-size: 0.95rem; }
  </style>
</head>
<body>
  <main>
    <h1>Product passport not found</h1>
    <p>${message}</p>
  </main>
</body>
</html>`
}
