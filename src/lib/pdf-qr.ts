import QRCode from "qrcode"
import { buildGS1DigitalLink, normalizeGtinDigits, padGTIN, validateGTIN } from "@/lib/gs1"

/** Default GS1 resolver host when env is unset. */
export const DEFAULT_GS1_DIGITAL_LINK_DOMAIN = "id.originpass.app"

/** Domain used for GS1 Digital Link QR payloads (no protocol). */
export function gs1DigitalLinkDomain(): string {
  const raw =
    process.env.GS1_DIGITAL_LINK_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    DEFAULT_GS1_DIGITAL_LINK_DOMAIN
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "")
}

/**
 * Build a GS1 Digital Link URL for a GTIN, e.g.
 * `https://id.originpass.app/01/00810012345675`
 */
export function buildGs1QrTargetUrl(input: {
  gtin: string
  domain?: string
  lot?: string | null
  serial?: string | null
}): string {
  const domain = (input.domain ?? gs1DigitalLinkDomain()).trim()
  const gtin = normalizeGtinDigits(input.gtin)
  if (!gtin || !validateGTIN(gtin)) return ""
  return buildGS1DigitalLink(domain, gtin, input.lot ?? undefined, input.serial ?? undefined)
}

/** Human-readable AI (01) GTIN line for print labels: `(01) 00810012345675`. */
export function formatGtinAi01(gtin: string | null | undefined): string | null {
  const digits = normalizeGtinDigits(gtin ?? "")
  if (!digits) return null
  const padded = padGTIN(digits) || digits
  return `(01) ${padded}`
}

export type PdfQrOptions = {
  /** Pixel width of the generated PNG (print density). Default 512. */
  width?: number
  errorCorrectionLevel?: "L" | "M" | "Q" | "H"
  margin?: number
}

/**
 * High-resolution PNG data URI for embedding in `@react-pdf/renderer` Image nodes.
 */
export async function generatePdfQrDataUri(
  targetUrl: string,
  options: PdfQrOptions = {},
): Promise<string> {
  const url = targetUrl.trim()
  if (!url) {
    throw new Error("generatePdfQrDataUri requires a non-empty target URL")
  }
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: options.errorCorrectionLevel ?? "M",
    margin: options.margin ?? 1,
    width: options.width ?? 512,
    color: { dark: "#111111", light: "#ffffff" },
  })
}

/**
 * Convenience: GS1 Digital Link URL -> print-ready QR data URI.
 */
export async function generateGs1PdfQrDataUri(
  gtin: string,
  options?: PdfQrOptions & { domain?: string; lot?: string | null; serial?: string | null },
): Promise<{ url: string; qrDataUrl: string }> {
  const url = buildGs1QrTargetUrl({
    gtin,
    domain: options?.domain,
    lot: options?.lot,
    serial: options?.serial,
  })
  if (!url) {
    throw new Error("Invalid GTIN for GS1 Digital Link QR")
  }
  const qrDataUrl = await generatePdfQrDataUri(url, options)
  return { url, qrDataUrl }
}
