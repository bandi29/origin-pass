/**
 * GS1 Digital Link helpers - Modulo-10 check digits, URI build/parse.
 * Optional identifiers; callers must fall back to internal `/p` or `/sp` routes.
 */

const GTIN_LENGTHS = new Set([8, 12, 13, 14])

/** Strip non-digits; returns empty string when nothing remains. */
export function normalizeGtinDigits(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "")
}

/**
 * GS1 Modulo-10 check digit for the data digits (without the check digit).
 * Weights alternate 3,1,3,1... from the rightmost data digit.
 */
export function computeGtinCheckDigit(dataDigits: string): number {
  const digits = dataDigits.replace(/\D/g, "")
  let sum = 0
  const reversed = digits.split("").reverse()
  for (let i = 0; i < reversed.length; i++) {
    const n = Number(reversed[i])
    sum += n * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Validate GTIN-8 / UPC-A (12) / EAN-13 / GTIN-14 with Modulo-10 check digit.
 */
export function validateGTIN(gtin: string): boolean {
  const digits = normalizeGtinDigits(gtin)
  if (!GTIN_LENGTHS.has(digits.length)) return false
  if (!/^\d+$/.test(digits)) return false
  const data = digits.slice(0, -1)
  const check = Number(digits.slice(-1))
  return computeGtinCheckDigit(data) === check
}

/** Left-pad to 14 digits (GTIN-14). Returns empty string for empty input. */
export function padGTIN(gtin: string): string {
  const digits = normalizeGtinDigits(gtin)
  if (!digits) return ""
  return digits.padStart(14, "0")
}

/** Human label for a valid GTIN length, e.g. "GTIN-13". */
export function gtinFormatLabel(gtin: string): string | null {
  const digits = normalizeGtinDigits(gtin)
  if (!validateGTIN(digits)) return null
  return `GTIN-${digits.length}`
}

export type GS1DigitalLinkParts = {
  gtin: string
  lot?: string
  serial?: string
}

/**
 * Build a GS1 Digital Link URI:
 * `https://{domain}/01/{paddedGTIN}`[+`/10/{lot}`][+`/21/{serial}`]
 */
export function buildGS1DigitalLink(
  domain: string,
  gtin: string,
  lot?: string,
  serial?: string,
): string {
  const host = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
  const padded = padGTIN(gtin)
  if (!host || !padded) return ""

  let path = `/01/${encodeURIComponent(padded)}`
  const lotValue = lot?.trim()
  if (lotValue) path += `/10/${encodeURIComponent(lotValue)}`
  const serialValue = serial?.trim()
  if (serialValue) path += `/21/${encodeURIComponent(serialValue)}`
  return `https://${host}${path}`
}

/**
 * Parse Application Identifiers from a GS1 path segment list
 * (e.g. `["01","01234567890128","10","LOT1","21","SER1"]` or without leading "01").
 */
export function parseGS1DigitalLinkPath(segments: string[]): GS1DigitalLinkParts | null {
  const parts = segments
    .map((s) => decodeURIComponent(String(s ?? "").trim()))
    .filter(Boolean)
  if (parts.length === 0) return null

  const tokens = parts[0] === "01" || parts[0] === "gtin" ? parts : ["01", ...parts]

  let gtin = ""
  let lot: string | undefined
  let serial: string | undefined

  for (let i = 0; i < tokens.length; i++) {
    const ai = tokens[i]
    const value = tokens[i + 1]
    if (!value) break
    if (ai === "01" || ai === "gtin") {
      gtin = normalizeGtinDigits(value)
      i++
    } else if (ai === "10") {
      lot = value
      i++
    } else if (ai === "21") {
      serial = value
      i++
    }
  }

  if (!gtin) return null
  return { gtin, lot, serial }
}

/**
 * Prefer a GS1 Digital Link when GTIN is valid; otherwise use the standard fallback URL.
 */
export function resolvePassportLinkUrl(input: {
  domain: string
  gtin?: string | null
  lot?: string | null
  serial?: string | null
  fallbackUrl: string
}): { url: string; linkType: "gs1" | "standard" } {
  const gtin = input.gtin?.trim() ?? ""
  if (gtin && validateGTIN(gtin)) {
    const url = buildGS1DigitalLink(
      input.domain,
      gtin,
      input.lot ?? undefined,
      input.serial ?? undefined,
    )
    if (url) return { url, linkType: "gs1" }
  }
  return { url: input.fallbackUrl, linkType: "standard" }
}
