import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { isValidUuid } from "@/lib/security"
import { normalizeGtinDigits, padGTIN, resolvePassportLinkUrl, validateGTIN } from "@/lib/gs1"
import {
  formatGtinAi01,
  generatePdfQrDataUri,
  gs1DigitalLinkDomain,
} from "@/lib/pdf-qr"
import {
  PrintDocument,
  type PrintLabelData,
  type PrintLayoutType,
} from "@/components/pdf/PrintLayouts"

export type { PrintLayoutType, PrintLabelData }
export type HangtagLayoutType = PrintLayoutType
export type HangtagLabelData = PrintLabelData

export const HANGTAG_LAYOUTS = ["hangtag-2x3", "avery-5160", "thermal-4x6"] as const

export function isHangtagLayoutType(value: string): value is PrintLayoutType {
  return (HANGTAG_LAYOUTS as readonly string[]).includes(value)
}

export { gs1DigitalLinkDomain }

export type HangtagPassportSource = {
  passportId: string
  productTitle: string
  variantName: string
  serialNumber: string
  verifyToken: string | null
  passportUid: string
  /** Resolved GTIN used on the label (variant override -> passport -> product). */
  gtin: string | null
  lotNumber: string | null
  fallbackUrl: string
}

const EMPTY_SERIAL = "-"

export async function loadHangtagPassportSource(
  userId: string,
  passportId: string,
  options?: { variantGtin?: string | null; baseUrl?: string },
): Promise<HangtagPassportSource | null> {
  if (!isValidUuid(passportId)) return null
  const inScope = await isPassportInScope(userId, passportId)
  if (!inScope) return null

  const admin = createAdminClient()
  const { data: passport, error } = await admin
    .from("passports")
    .select(
      "id, passport_uid, serial_number, verify_token, gtin, external_variant_id, product:products(id, name, gtin, default_lot_number, external_product_id)",
    )
    .eq("id", passportId)
    .maybeSingle()

  if (error || !passport) return null

  const product = (
    Array.isArray(passport.product) ? passport.product[0] : passport.product
  ) as
    | {
        id?: string
        name?: string | null
        gtin?: string | null
        default_lot_number?: string | null
        external_product_id?: string | null
      }
    | null
    | undefined

  const overrideGtin = normalizeGtinDigits(options?.variantGtin ?? "")
  const passportGtin = normalizeGtinDigits((passport as { gtin?: string | null }).gtin ?? "")
  const productGtin = normalizeGtinDigits(product?.gtin ?? "")
  const gtinCandidate =
    (overrideGtin && validateGTIN(overrideGtin) ? overrideGtin : null) ||
    (passportGtin && validateGTIN(passportGtin) ? passportGtin : null) ||
    (productGtin && validateGTIN(productGtin) ? productGtin : null)

  const baseUrl = (options?.baseUrl || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  )
  const token =
    (passport as { verify_token?: string | null }).verify_token?.trim() ||
    (passport as { passport_uid?: string }).passport_uid
  const fallbackUrl = `${baseUrl}/verify/${token}`

  const externalVariant = (passport as { external_variant_id?: string | null }).external_variant_id?.trim()
  const serial = (passport as { serial_number?: string | null }).serial_number?.trim() || EMPTY_SERIAL

  return {
    passportId: passport.id as string,
    productTitle: product?.name?.trim() || "Product passport",
    variantName: externalVariant ? `Variant ${externalVariant}` : serial === EMPTY_SERIAL ? "" : serial,
    serialNumber: serial,
    verifyToken: (passport as { verify_token?: string | null }).verify_token ?? null,
    passportUid: (passport as { passport_uid: string }).passport_uid,
    gtin: gtinCandidate,
    lotNumber: product?.default_lot_number?.trim() || null,
    fallbackUrl,
  }
}

export function resolveHangtagScanUrl(source: HangtagPassportSource): {
  url: string
  linkType: "gs1" | "standard"
  gtinDisplay: string | null
} {
  const domain = gs1DigitalLinkDomain()
  const resolved = resolvePassportLinkUrl({
    domain,
    gtin: source.gtin,
    lot: source.lotNumber,
    serial: source.serialNumber !== EMPTY_SERIAL ? source.serialNumber : null,
    fallbackUrl: source.fallbackUrl,
  })
  const gtinDisplay = source.gtin ? padGTIN(source.gtin) || source.gtin : null
  return { ...resolved, gtinDisplay }
}

export async function buildHangtagLabelData(source: HangtagPassportSource): Promise<PrintLabelData> {
  const { url, linkType, gtinDisplay } = resolveHangtagScanUrl(source)
  const qrDataUrl = await generatePdfQrDataUri(url)

  return {
    productTitle: source.productTitle,
    variantName: source.variantName,
    serialNumber: source.serialNumber,
    scanUrl: url,
    linkType,
    gtinDisplay,
    gtinAi01: formatGtinAi01(gtinDisplay),
    qrDataUrl,
    footerText: "EU Digital Product Passport",
  }
}

export async function renderHangtagPdf(
  layoutType: PrintLayoutType,
  label: PrintLabelData,
): Promise<Buffer> {
  const element = createElement(PrintDocument, { layoutType, label })
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0])
  return Buffer.from(buffer)
}

/** `passport-{gtin}-{layoutType}.pdf` (falls back to serial when GTIN missing). */
export function hangtagPdfFilename(
  gtinDisplay: string | null,
  serialNumber: string,
  layoutType: PrintLayoutType,
): string {
  const id =
    normalizeGtinDigits(gtinDisplay ?? "") ||
    serialNumber.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) ||
    "label"
  return `passport-${id}-${layoutType}.pdf`
}
