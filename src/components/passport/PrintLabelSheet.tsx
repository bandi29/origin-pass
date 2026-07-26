"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import type { PrintableProduct } from "@/app/(shopify-embedded)/api/shopify/app-home/actions"

/** Avery 5160: US Letter, 3 columns × 10 rows = 30 labels/page (2.625in × 1in). */
const LABELS_PER_PAGE = 30

export type LabelFormat = "avery5160" | "thermal"

type ExpandedLabel = PrintableProduct & { labelKey: string }

const FORMAT_OPTIONS: { value: LabelFormat; label: string }[] = [
  { value: "avery5160", label: "Avery 5160 Sheet (30-up)" },
  { value: "thermal", label: "Thermal Roll (Single 2×2)" },
]

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function clampQuantity(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return 1
  return Math.min(999, Math.max(1, Math.floor(raw)))
}

/** Repeat each product `quantity` times for sequential grid placement. */
function expandLabelsByQuantity(products: PrintableProduct[]): ExpandedLabel[] {
  const out: ExpandedLabel[] = []
  for (const product of products) {
    const quantity = clampQuantity(product.quantity)
    for (let copy = 0; copy < quantity; copy++) {
      out.push({
        ...product,
        labelKey: `${product.id}-${copy}`,
      })
    }
  }
  return out
}

function linkTypeTag(linkType: PrintableProduct["linkType"] | undefined): string {
  return linkType === "gs1" ? "[GS1 Digital Link]" : "[Standard Link]"
}

/** Avery 5160 cell — QR encodes GS1 `/01/{gtin}` when set, else `/sp/{shop}/{productId}`. */
function AveryLabelCell({ product }: { product: ExpandedLabel }) {
  return (
    <div className="flex items-center gap-2 overflow-hidden px-2 print:break-inside-avoid print:overflow-visible print:px-1">
      <QRCodeSVG
        value={product.url}
        size={72}
        level="M"
        marginSize={0}
        className="h-[0.75in] w-[0.75in] shrink-0 print:block"
      />
      <div className="min-w-0 print:text-black">
        <p className="truncate text-[10px] font-semibold leading-tight text-neutral-900 print:text-black">
          {product.title}
        </p>
        {product.sku ? (
          <p className="truncate text-[8px] leading-tight text-neutral-500 print:text-black">SKU {product.sku}</p>
        ) : null}
        <p className="mt-0.5 text-[7px] uppercase tracking-wide text-neutral-400 print:text-black">
          Verify · OriginPass
        </p>
        <p className="truncate text-[6px] leading-tight text-neutral-400 print:text-black">
          {linkTypeTag(product.linkType)}
        </p>
      </div>
    </div>
  )
}

function ThermalLabelCell({ product }: { product: ExpandedLabel }) {
  return (
    <div
      className={[
        "thermal-label flex h-[2in] w-[2in] flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-neutral-200 bg-white p-2 shadow-sm",
        "print:m-0 print:rounded-none print:border-0 print:p-1 print:shadow-none",
        "print:h-[2in] print:w-[2in]",
        // Page breaks are applied via CSS `:not(:last-child)` so the final
        // sticker never forces an empty trailing sheet.
      ].join(" ")}
    >
      <QRCodeSVG
        value={product.url}
        size={56}
        level="M"
        marginSize={0}
        className="h-[1.1in] w-[1.1in] shrink-0 print:block"
      />
      <p className="max-w-full truncate px-1 text-center text-[8px] font-semibold leading-tight text-neutral-900 print:text-black">
        {product.title}
      </p>
      <p className="text-[6px] uppercase tracking-wide text-neutral-400 print:text-black">OriginPass</p>
      <p className="max-w-full truncate px-1 text-center text-[5px] leading-tight text-neutral-400 print:text-black">
        {linkTypeTag(product.linkType)}
      </p>
    </div>
  )
}

/**
 * Print-ready label engine — Avery 5160 sheets or continuous thermal roll.
 */
export function PrintLabelSheet({
  products,
  onClose,
  initialFormat = "avery5160",
}: {
  products: PrintableProduct[]
  onClose: () => void
  initialFormat?: LabelFormat
}) {
  const [labelFormat, setLabelFormat] = useState<LabelFormat>(initialFormat)

  useEffect(() => {
    setLabelFormat(initialFormat)
  }, [initialFormat])

  // The preview is a full-screen takeover — Escape must always offer a way out.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  // Hard render cap: quantities allow up to 999 per product, so a large selection
  // could expand to hundreds of thousands of QR SVGs and freeze the tab. 1,500
  // stickers = 50 Avery sheets — a sane single print batch.
  const MAX_PRINT_STICKERS = 1500
  const { expandedLabels, truncatedCount } = useMemo(() => {
    const all = expandLabelsByQuantity(products)
    if (all.length <= MAX_PRINT_STICKERS) return { expandedLabels: all, truncatedCount: 0 }
    return {
      expandedLabels: all.slice(0, MAX_PRINT_STICKERS),
      truncatedCount: all.length - MAX_PRINT_STICKERS,
    }
  }, [products])
  const averyPages = useMemo(() => chunk(expandedLabels, LABELS_PER_PAGE), [expandedLabels])
  const totalStickers = expandedLabels.length
  const productLines = products.length

  const formatMeta = useMemo(() => {
    if (labelFormat === "thermal") {
      return {
        title: "Print preview · Thermal roll",
        subtitle: `${totalStickers} sticker${totalStickers === 1 ? "" : "s"} · 2×2 in · 1 per slice`,
      }
    }
    return {
      title: "Print preview · Avery 5160",
      subtitle: `${totalStickers} sticker${totalStickers === 1 ? "" : "s"} from ${productLines} product${productLines === 1 ? "" : "s"} · ${averyPages.length} sheet${averyPages.length === 1 ? "" : "s"} · 30-up`,
    }
  }, [labelFormat, totalStickers, productLines, averyPages.length])

  const pageRule =
    labelFormat === "thermal"
      ? "@page { size: 2in 2in; margin: 0; }"
      : "@page { size: letter portrait; margin: 0; }"

  // Screen preview: wrap stickers in a compact grid so selecting many SKUs
  // does not produce a single endless vertical column (unreadable in admin).
  // Print CSS still emits one 2×2 sticker per page for the physical roll.
  const THERMAL_SCREEN_PREVIEW_CAP = 24
  const thermalScreenLabels = useMemo(() => {
    if (labelFormat !== "thermal") return expandedLabels
    return expandedLabels.slice(0, THERMAL_SCREEN_PREVIEW_CAP)
  }, [expandedLabels, labelFormat])
  const thermalScreenHidden = Math.max(0, expandedLabels.length - thermalScreenLabels.length)

  const printStyles =
    labelFormat === "thermal"
      ? `
        .thermal-roll-root {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(2in, 2in));
          justify-content: center;
          gap: 1rem;
          width: 100%;
          max-width: 56rem;
        }
        @media print {
          .thermal-roll-root {
            display: block;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            padding-bottom: 0 !important;
            gap: 0;
          }
          .thermal-screen-only { display: none !important; }
          /* Force a new sticker per page, but never after the last cell. */
          .thermal-label:not(:last-child) {
            break-after: page;
            page-break-after: always;
          }
          .thermal-label:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `
      : `
        .avery-grid {
          display: grid;
          grid-template-columns: repeat(3, 2.625in);
          column-gap: 0.125in;
          grid-auto-rows: 1in;
          justify-content: center;
        }
        @media print {
          .avery-page:not(:last-child) {
            break-after: page;
            page-break-after: always;
          }
          .avery-page:last-child {
            break-after: auto;
            page-break-after: auto;
            height: auto !important;
            min-height: 0 !important;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }
        }
      `

  return (
    <div className="print-label-overlay fixed inset-0 z-[200] flex flex-col bg-neutral-100 print:static print:block print:h-auto print:min-h-0 print:w-full print:bg-white print:m-0 print:p-0 print:pb-0 print:mb-0">
      <style>{`
        @media print {
          ${pageRule}
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .print-label-overlay {
            position: static !important;
            inset: auto !important;
            z-index: auto !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            padding-bottom: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .print-label-preview-chrome {
            display: block !important;
            flex: none !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            padding-bottom: 0 !important;
            overflow: visible !important;
          }
          /* Boundary check: the print root must own the full page width and
             never clip. @page margin is 0 (set above), so the sheet's own
             calibrated padding is the ONLY inset — Avery top registration is
             the 0.5in grid padding-top below; do not add extra padding here or
             printed labels will misalign with the physical label stock. */
          #avery-print-root {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            padding-bottom: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #avery-print-root svg,
          #avery-print-root img {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        ${printStyles}
      `}</style>

      {/* Sticky control center (screen only) */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur-sm print:hidden">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back to Catalog
          </button>

          <div className="flex shrink-0 flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Label format</span>
            <div
              className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5"
              role="group"
              aria-label="Label format"
            >
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLabelFormat(option.value)}
                  className={[
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                    labelFormat === option.value
                      ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200"
                      : "text-neutral-600 hover:text-neutral-900",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* flex-1 + min-w-0 gives the metadata a real width constraint so the
              title truncates predictably; the counts line wraps (never clips —
              sheet ratios are load-bearing info for the merchant). */}
          <div className="min-w-0 flex-1 basis-56 border-l border-neutral-200 pl-3">
            <p className="truncate text-sm font-semibold text-neutral-900">{formatMeta.title}</p>
            <p className="break-words text-xs leading-snug text-neutral-500">{formatMeta.subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
        >
          Print now
        </button>
      </div>

      {/* Scrollable on-screen preview; print surface is the sheet root below */}
      {truncatedCount > 0 ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950 print:hidden">
          Showing the first {MAX_PRINT_STICKERS.toLocaleString()} stickers ({truncatedCount.toLocaleString()} more
          selected). Print this batch, then reduce quantities or selection for the next run.
        </p>
      ) : null}

      <div className="print-label-preview-chrome flex flex-1 justify-center overflow-auto p-6 print:m-0 print:mb-0 print:block print:h-auto print:min-h-0 print:overflow-visible print:p-0 print:pb-0">
        {products.length === 0 ? (
          <p className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500 print:hidden">
            No products selected. Pick at least one product to print labels.
          </p>
        ) : labelFormat === "thermal" ? (
          <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-4 print:mx-0 print:mb-0 print:max-w-none print:gap-0 print:p-0">
            {thermalScreenHidden > 0 ? (
              <p className="thermal-screen-only rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-center text-sm text-neutral-600 shadow-sm print:hidden">
                Previewing {thermalScreenLabels.length} of {totalStickers.toLocaleString()} thermal stickers in a
                grid. Print still outputs the full roll (one 2×2 sticker per slice).
              </p>
            ) : (
              <p className="thermal-screen-only rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-center text-sm text-neutral-600 shadow-sm print:hidden">
                On-screen grid preview · print outputs one 2×2 sticker per thermal slice
              </p>
            )}
            <div
              id="avery-print-root"
              data-format="thermal"
              className="thermal-roll-root mx-auto print:mx-0 print:mb-0 print:h-auto print:pb-0"
            >
              {/* Screen: capped grid. Print: full expanded set (hidden extras still print). */}
              {thermalScreenLabels.map((product) => (
                <ThermalLabelCell key={product.labelKey} product={product} />
              ))}
              {thermalScreenHidden > 0
                ? expandedLabels.slice(THERMAL_SCREEN_PREVIEW_CAP).map((product) => (
                    <div key={product.labelKey} className="hidden print:block">
                      <ThermalLabelCell product={product} />
                    </div>
                  ))
                : null}
            </div>
          </div>
        ) : (
          <div
            id="avery-print-root"
            data-format="avery5160"
            className="mx-auto w-full max-w-5xl space-y-8 print:mx-0 print:mb-0 print:max-w-none print:space-y-0 print:h-auto print:pb-0"
          >
            {averyPages.map((pageItems, pageIndex) => {
              const isLastPage = pageIndex === averyPages.length - 1
              return (
              <div
                key={pageIndex}
                className={[
                  "avery-page rounded-md bg-white p-[0.5in] shadow-sm ring-1 ring-neutral-200",
                  "print:rounded-none print:ring-0",
                  "print:bg-white print:p-0 print:m-0 print:mb-0 print:w-[8.5in] print:shadow-none",
                  // Fixed letter height only for non-final sheets; last sheet is
                  // height:auto so leftover whitespace cannot spill onto page 2.
                  isLastPage ? "print:h-auto print:min-h-0 print:pb-0" : "print:h-[11in]",
                  "print:overflow-visible print:break-after-auto",
                ].join(" ")}
              >
                <div className="avery-grid print:box-border print:px-[0.1875in] print:pt-[0.5in] print:pb-0">
                  {pageItems.map((product) => (
                    <AveryLabelCell key={product.labelKey} product={product} />
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
