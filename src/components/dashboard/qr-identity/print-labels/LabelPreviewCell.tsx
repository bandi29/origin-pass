"use client"

import clsx from "clsx"
import { QRCodeSVG } from "qrcode.react"
import { MiniQrGlyph } from "@/components/dashboard/qr-identity/print-labels/MiniQrGlyph"
import { PASSPORT_MARK_FONT } from "@/components/dashboard/qr-identity/print-labels/constants"
import type { PreviewMode, QrStyleId } from "@/components/dashboard/qr-identity/print-labels/types"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { productDisplayLabel } from "@/lib/product-display-label"

export type LabelFace = "front" | "back"

export type LabelPreviewBranding = {
  qrStyle: QrStyleId
  brandColor: string
  borderStyle: "none" | "thin" | "premium"
  typographyStyle: "serif" | "sans" | "luxury"
  footerText: string
  showLogo: boolean
  showQrCode: boolean
  showProductName: boolean
  qrSizeInches: number
  labelTextPt: number
}

export type LabelPreviewCellProps = {
  product: ProductPrintCandidate | null
  face?: LabelFace
  previewMode: PreviewMode
  branding: LabelPreviewBranding
  scanUrl: string | null
  /** Sheet grid uses a denser layout. */
  compact?: boolean
}

function borderClass(style: LabelPreviewBranding["borderStyle"]) {
  if (style === "none") return "border-transparent"
  if (style === "thin") return "border border-[#E7E2D7]"
  return "border-2 border-[#E7E2D7]/90 shadow-sm"
}

function typographyFont(style: LabelPreviewBranding["typographyStyle"]) {
  if (style === "serif" || style === "luxury") return { fontFamily: PASSPORT_MARK_FONT }
  return undefined
}

function QrBlock({
  branding,
  scanUrl,
  compact,
}: {
  branding: LabelPreviewBranding
  scanUrl: string | null
  compact?: boolean
}) {
  const qrPx = Math.round(branding.qrSizeInches * (compact ? 56 : 72))
  const qrBox = clsx(
    "mx-auto flex items-center justify-center rounded-sm border bg-white shadow-[0_2px_4px_rgba(14,27,42,0.05)]",
    compact ? "p-1.5" : "p-3",
    branding.qrStyle === "dot" && "border-2 border-dashed border-[#9AA0A8]",
    branding.qrStyle === "shield" && "border-0 bg-[#0E1B2A]",
    branding.qrStyle === "minimal" && "border border-[#E7E2D7]",
    branding.qrStyle === "luxury" &&
      "border border-[#B9722B]/40 bg-gradient-to-br from-white to-[#FBEEDD]/40",
    branding.qrStyle === "classic" && "border-2 border-[#0E1B2A]",
  )

  if (!branding.showQrCode) {
    return <div className={clsx(qrBox, compact ? "h-12 w-12" : "h-16 w-16")} aria-hidden />
  }

  return (
    <div className={qrBox} style={{ width: qrPx + (compact ? 12 : 24), height: qrPx + (compact ? 12 : 24) }}>
      {scanUrl ? (
        <QRCodeSVG
          value={scanUrl}
          size={qrPx}
          level="M"
          includeMargin={false}
          fgColor={branding.qrStyle === "shield" ? "#ffffff" : branding.brandColor || "#0E1B2A"}
          bgColor={branding.qrStyle === "shield" ? "#0E1B2A" : "#ffffff"}
        />
      ) : (
        <MiniQrGlyph className={compact ? "h-10 w-10" : "h-14 w-14"} />
      )}
    </div>
  )
}

function LabelBackFace({
  product,
  branding,
  compact,
}: {
  product: ProductPrintCandidate
  branding: LabelPreviewBranding
  compact?: boolean
}) {
  const origin = product.origin?.trim()
  const materials = product.materials?.trim()
  const maker = product.supplier?.trim()
  const story = product.story?.trim()
  const lines = [
    origin ? { k: "Origin", v: origin } : null,
    materials ? { k: "Materials", v: materials } : null,
    maker ? { k: "Maker", v: maker } : null,
    story ? { k: "Story", v: story } : null,
  ].filter(Boolean) as { k: string; v: string }[]

  return (
    <article
      className={clsx(
        "flex h-full flex-col rounded-2xl bg-white text-left",
        compact ? "p-2" : "p-4",
        borderClass(branding.borderStyle),
      )}
      style={typographyFont(branding.typographyStyle)}
    >
      <p
        className={clsx(
          "font-semibold uppercase tracking-[0.12em] text-[#9AA0A8]",
          compact ? "text-[7px]" : "text-[9px]",
        )}
      >
        Provenance
      </p>
      {lines.length === 0 ? (
        <p className={clsx("mt-2 text-[#6B7079]", compact ? "text-[8px]" : "text-xs")}>
          Passport story will appear when product origin and materials are recorded.
        </p>
      ) : (
        <ul className={clsx("mt-2 space-y-1.5 text-[#15293E]", compact ? "text-[8px] leading-snug" : "text-[11px] leading-relaxed")}>
          {lines.map((line) => (
            <li key={line.k}>
              <span className="font-semibold text-[#6B7079]">{line.k}: </span>
              <span className={line.k === "Story" ? "line-clamp-3" : undefined}>{line.v}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function LabelFrontFace({
  product,
  branding,
  scanUrl,
  previewMode,
  compact,
}: {
  product: ProductPrintCandidate
  branding: LabelPreviewBranding
  scanUrl: string | null
  previewMode: PreviewMode
  compact?: boolean
}) {
  const name = productDisplayLabel(product.id, product.name)
  const sku = product.sku?.trim() ?? "—"
  const verified =
    product.verificationStatus.toLowerCase() === "verified"
      ? branding.footerText || "Verified with OriginPass"
      : "Traceability record"

  const nameClass = compact
    ? "text-[9px]"
    : previewMode === "hangtag"
      ? "text-sm"
      : "text-base"
  const skuClass = compact ? "text-[7px]" : "text-[11px]"

  return (
    <article
      className={clsx(
        "flex h-full flex-col items-center rounded-2xl bg-white text-center",
        compact ? "px-2 py-2" : previewMode === "hangtag" ? "px-4 py-5" : "px-5 py-6",
        borderClass(branding.borderStyle),
      )}
      style={typographyFont(branding.typographyStyle)}
    >
      {branding.showLogo ? (
        <div className={clsx("flex items-center justify-center gap-1.5", compact ? "mb-1" : "mb-2")}>
          <span
            className={clsx(
              "grid place-items-center rounded bg-[#0E1B2A] font-serif font-bold text-white",
              compact ? "h-3 w-3 text-[6px]" : "h-4 w-4 text-[8px]",
            )}
          >
            OP
          </span>
          <span className={clsx("font-serif font-semibold text-[#0E1B2A]", compact ? "text-[8px]" : "text-xs")}>
            OriginPass
          </span>
        </div>
      ) : null}
      <QrBlock branding={branding} scanUrl={scanUrl} compact={compact} />
      {branding.showProductName ? (
        <>
          <p className={clsx("mt-2 truncate font-semibold text-[#0E1B2A]", nameClass)}>{name}</p>
          <p className={clsx("truncate font-mono tracking-wide text-[#6B7079]", skuClass)}>{sku}</p>
        </>
      ) : null}
      <p
        className={clsx(
          "mt-1.5 truncate tracking-[0.04em] text-[#356B4E]",
          compact ? "text-[6.5px]" : "text-[10px]",
        )}
      >
        ✦ {verified}
      </p>
    </article>
  )
}

/** Single label / sheet cell renderer — shared by Label Studio canvas and inspector dock. */
export function LabelPreviewCell({
  product,
  face = "front",
  previewMode,
  branding,
  scanUrl,
  compact = false,
}: LabelPreviewCellProps) {
  if (!product) {
    return (
      <div
        className={clsx(
          "flex h-full min-h-[80px] items-center justify-center rounded-xl border border-dashed border-[#E7E2D7] bg-[#FCFBF8] text-xs text-[#9AA0A8]",
          compact && "min-h-[48px] text-[9px]",
        )}
      >
        Label
      </div>
    )
  }

  if (face === "back") {
    return <LabelBackFace product={product} branding={branding} compact={compact} />
  }

  return (
    <LabelFrontFace
      product={product}
      branding={branding}
      scanUrl={scanUrl}
      previewMode={previewMode}
      compact={compact}
    />
  )
}
