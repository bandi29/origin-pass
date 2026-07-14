"use client"

import { useCallback, useMemo } from "react"
import type { RefObject } from "react"
import clsx from "clsx"
import { Minus, Plus, SlidersHorizontal } from "lucide-react"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { LabelPreviewCell } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewCell"
import { LabelPreviewStage } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewStage"
import type { LabelPreviewBranding } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewCell"
import type { PreviewMode, VisualTemplate } from "@/components/dashboard/qr-identity/print-labels/types"
import type { PreviewZoom } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-layout"

export type LabelStudioCanvasProps = {
  selectedProducts: ProductPrintCandidate[]
  selectionCount: number
  /** Hidden print root — cloned into the system print dialog. */
  printContentRef?: RefObject<HTMLDivElement | null>
  onOpenPicker: (trigger?: HTMLElement | null) => void
  inspectorHidden?: boolean
  onOpenInspector?: (trigger?: HTMLElement | null) => void
  previewMode: PreviewMode
  previewZoom: PreviewZoom
  onZoomOut: () => void
  onZoomIn: () => void
  cellWidthMm: number
  cellHeightMm: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  labelGapPx: number
  gridCols: number
  gridPreviewCount: number
  snapToGrid: boolean
  bleedMm: number
  showCropMarks: boolean
  branding: LabelPreviewBranding
  printPreviewScanUrl: string | null
  labelFace: "front" | "back"
  onLabelFaceChange: (face: "front" | "back") => void
  showFaceToggle: boolean
  selectedTemplate: VisualTemplate | null
  sheetCapacity: number
  sheetRows: number
}

function FaceToggle({
  face,
  onChange,
}: {
  face: "front" | "back"
  onChange: (face: "front" | "back") => void
}) {
  return (
    <div
      className="flex rounded-[10px] bg-[#F1EEE7] p-[3px]"
      role="group"
      aria-label="Label face"
    >
      {(["front", "back"] as const).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={clsx(
            "rounded-lg px-3 py-1 text-[11.5px] font-semibold capitalize transition",
            face === id
              ? "bg-white text-[#0E1B2A] shadow-[0_1px_2px_rgba(14,27,42,0.05)]"
              : "text-[#6B7079] hover:text-[#15293E]",
          )}
          aria-pressed={face === id}
        >
          {id}
        </button>
      ))}
    </div>
  )
}

export function LabelStudioCanvas({
  selectedProducts,
  selectionCount,
  printContentRef,
  onOpenPicker,
  inspectorHidden,
  onOpenInspector,
  previewMode,
  previewZoom,
  onZoomOut,
  onZoomIn,
  cellWidthMm,
  cellHeightMm,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  labelGapPx,
  gridCols,
  gridPreviewCount,
  snapToGrid,
  bleedMm,
  showCropMarks,
  branding,
  printPreviewScanUrl,
  labelFace,
  onLabelFaceChange,
  showFaceToggle,
  selectedTemplate,
  sheetCapacity,
  sheetRows,
}: LabelStudioCanvasProps) {
  const isEmpty = selectionCount === 0
  const compact = previewMode === "sheet"

  const modeTitle = useMemo(() => {
    switch (previewMode) {
      case "sheet":
        return "Sheet preview"
      case "hangtag":
        return "Hang tag"
      case "packaging":
        return "Packaging"
      default:
        return "Single label"
    }
  }, [previewMode])

  const renderLabelCell = useCallback(
    (index: number) => {
      const cycle = Math.max(selectedProducts.length, 1)
      const product = selectedProducts[index % cycle] ?? null
      return (
        <LabelPreviewCell
          product={product}
          face={labelFace}
          previewMode={previewMode}
          branding={branding}
          scanUrl={printPreviewScanUrl}
          compact={compact}
        />
      )
    },
    [selectedProducts, labelFace, previewMode, branding, printPreviewScanUrl, compact],
  )

  const sheetMeta =
    previewMode === "sheet" && !isEmpty
      ? `${gridCols}×${sheetRows} · ${gridPreviewCount} of ${sheetCapacity} cells`
      : null

  return (
    <main
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#F7F4EE]"
      aria-label="Label preview canvas"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E7E2D7]/80 bg-[#FCFBF8]/90 px-4 py-2.5 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="font-serif text-sm font-semibold text-[#0E1B2A]">{modeTitle}</p>
          <p className="font-mono text-[11px] tabular-nums text-[#6B7079]">
            {cellWidthMm.toFixed(1)} × {cellHeightMm.toFixed(1)} mm
            {sheetMeta ? <span className="text-[#9AA0A8]"> · {sheetMeta}</span> : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showFaceToggle ? (
            <FaceToggle face={labelFace} onChange={onLabelFaceChange} />
          ) : null}

          <div
            className="flex items-center gap-0.5 rounded-[10px] border border-[#E7E2D7] bg-white p-0.5"
            role="group"
            aria-label="Preview zoom"
          >
            <button
              type="button"
              onClick={onZoomOut}
              disabled={previewZoom <= 50}
              className="rounded-lg p-1.5 text-[#6B7079] transition hover:bg-[#F1EEE7] hover:text-[#0E1B2A] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#356B4E]"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className="min-w-[2.75rem] text-center text-[11px] font-semibold tabular-nums text-[#15293E]">
              {previewZoom}%
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              disabled={previewZoom >= 150}
              className="rounded-lg p-1.5 text-[#6B7079] transition hover:bg-[#F1EEE7] hover:text-[#0E1B2A] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#356B4E]"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto overscroll-contain p-4 md:p-5">
        {isEmpty ? (
          <div className="flex max-w-sm flex-col items-center text-center">
            <div
              className="relative aspect-[3/4] w-full max-w-[240px] rounded-2xl border border-dashed border-[#D8D3C7] bg-white/80 shadow-[0_12px_40px_rgba(14,27,42,0.06)]"
              aria-hidden
            >
              <div className="absolute inset-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E7E2D7] bg-[#FCFBF8] opacity-70">
                <span className="font-serif text-lg font-semibold text-[#9AA0A8]">OriginPass</span>
                <div className="mt-4 h-14 w-14 rounded-lg bg-[#F1EEE7]" />
                <div className="mt-3 h-2 w-20 rounded bg-[#F1EEE7]" />
                <div className="mt-1.5 h-2 w-14 rounded bg-[#F1EEE7]" />
              </div>
            </div>
            <p className="mt-6 text-sm font-medium text-[#15293E]">No products selected</p>
            <p className="mt-1 text-xs leading-relaxed text-[#6B7079]">
              Add products to preview labels on the canvas.
            </p>
            <button
              type="button"
              onClick={(e) => onOpenPicker(e.currentTarget)}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#356B4E]/50 bg-[#E7F0EA]/50 px-5 py-2.5 text-sm font-semibold text-[#27543D] transition hover:bg-[#E7F0EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add products
            </button>
          </div>
        ) : (
          <div
            ref={printContentRef}
            className="label-studio-print-root flex max-h-full max-w-full items-center justify-center"
          >
            <LabelPreviewStage
              previewMode={previewMode}
              previewZoom={previewZoom}
              marginTop={marginTop}
              marginRight={marginRight}
              marginBottom={marginBottom}
              marginLeft={marginLeft}
              cellWidthMm={cellWidthMm}
              cellHeightMm={cellHeightMm}
              labelGapPx={labelGapPx}
              gridCols={gridCols}
              gridPreviewCount={gridPreviewCount}
              snapToGrid={snapToGrid}
              bleedMm={bleedMm}
              showCropMarks={showCropMarks}
              renderLabelCell={renderLabelCell}
              className="w-full"
            />
          </div>
        )}
      </div>

      {selectedTemplate && !isEmpty ? (
        <p className="sr-only">
          Template {selectedTemplate.name}, {selectedTemplate.dimensions}
        </p>
      ) : null}

      {inspectorHidden && onOpenInspector ? (
        <button
          type="button"
          onClick={(e) => onOpenInspector(e.currentTarget)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-[#E7E2D7] bg-white px-4 py-2.5 text-sm font-semibold text-[#15293E] shadow-lg transition hover:border-[#356B4E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
          aria-label="Open inspector panel"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#356B4E]" aria-hidden />
          Inspector
        </button>
      ) : null}
    </main>
  )
}
