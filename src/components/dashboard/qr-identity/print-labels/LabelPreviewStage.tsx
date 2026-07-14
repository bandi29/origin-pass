"use client"

import clsx from "clsx"
import type { ReactNode } from "react"
import { previewMmToPx } from "@/components/dashboard/qr-identity/print-labels/layout-utils"
import type { PreviewMode } from "@/components/dashboard/qr-identity/print-labels/types"

export type LabelPreviewStageProps = {
  previewMode: PreviewMode
  previewZoom: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  cellWidthMm: number
  cellHeightMm: number
  labelGapPx: number
  gridCols: number
  gridPreviewCount: number
  snapToGrid: boolean
  /** Extra print bleed beyond the trim box (mm). Rendered as a tinted halo in preview. */
  bleedMm?: number
  showCropMarks: boolean
  renderLabelCell: (index: number) => ReactNode
  className?: string
}

const CROP_MARK_LEN_PX = 10
const CROP_MARK_OFFSET_PX = 4

/** Standard corner crop marks positioned just outside the trim box. */
function TrimCropMarks() {
  const len = CROP_MARK_LEN_PX
  const off = CROP_MARK_OFFSET_PX
  const stroke = "pointer-events-none absolute bg-[#6B7079]"

  return (
    <>
      <span className={stroke} style={{ left: -off, top: -off, width: 1, height: len }} aria-hidden />
      <span className={stroke} style={{ left: -off, top: -off, width: len, height: 1 }} aria-hidden />
      <span className={stroke} style={{ right: -off, top: -off, width: 1, height: len }} aria-hidden />
      <span className={stroke} style={{ right: -off, top: -off, width: len, height: 1 }} aria-hidden />
      <span className={stroke} style={{ left: -off, bottom: -off, width: 1, height: len }} aria-hidden />
      <span className={stroke} style={{ left: -off, bottom: -off, width: len, height: 1 }} aria-hidden />
      <span className={stroke} style={{ right: -off, bottom: -off, width: 1, height: len }} aria-hidden />
      <span className={stroke} style={{ right: -off, bottom: -off, width: len, height: 1 }} aria-hidden />
    </>
  )
}

/** Zoomable label sheet / single-label stage (shared by legacy canvas and Label Studio). */
export function LabelPreviewStage({
  previewMode,
  previewZoom,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  cellWidthMm,
  cellHeightMm,
  labelGapPx,
  gridCols,
  gridPreviewCount,
  snapToGrid,
  bleedMm = 0,
  showCropMarks,
  renderLabelCell,
  className,
}: LabelPreviewStageProps) {
  const cellWidthPx = previewMmToPx(cellWidthMm)
  const cellHeightPx = previewMmToPx(cellHeightMm)
  const bleedPx = previewMmToPx(bleedMm)
  const trimWidthPx = cellWidthPx
  const trimHeightPx = cellHeightPx
  const cellOuterWidthPx = trimWidthPx + bleedPx * 2
  const cellOuterHeightPx = trimHeightPx + bleedPx * 2
  const sheetWidthPx =
    gridCols * cellOuterWidthPx +
    Math.max(0, gridCols - 1) * labelGapPx +
    previewMmToPx(marginLeft + marginRight)

  if (gridPreviewCount === 0) return null

  return (
    <div className={clsx("flex max-h-full w-full min-h-0 flex-col items-center justify-center", className)}>
      <div
        className="label-preview-zoom-layer max-h-full max-w-full origin-center transition-transform duration-200 ease-out"
        style={{
          transform: `scale(${previewZoom / 100})`,
          transformOrigin: "center center",
        }}
      >
        <div
          className={clsx(
            "relative box-border overflow-visible rounded-xl border border-[#E7E2D7]/90 bg-white p-5 shadow-[0_20px_50px_rgba(14,27,42,0.1)] transition-[width,min-height] duration-200",
            previewMode === "packaging" && "max-w-md",
            previewMode === "hangtag" && "max-w-[260px]",
            previewMode === "single" && "max-w-[360px]",
          )}
          style={{
            width: previewMode === "sheet" ? sheetWidthPx + previewMmToPx(40) : undefined,
            minHeight:
              previewMode === "single" || previewMode === "hangtag"
                ? cellOuterHeightPx + previewMmToPx(marginTop + marginBottom + 40)
                : undefined,
          }}
        >
          <div
            className={clsx(
              "rounded-lg transition-[padding] duration-200",
              snapToGrid &&
                previewMode === "sheet" &&
                "bg-[radial-gradient(circle,#D8D3C7_1px,transparent_1px)] bg-[length:14px_14px]",
            )}
            style={{
              padding: `${previewMmToPx(marginTop)}px ${previewMmToPx(marginRight)}px ${previewMmToPx(marginBottom)}px ${previewMmToPx(marginLeft)}px`,
            }}
          >
            <div
              className="grid transition-[gap] duration-200"
              style={{
                gap: labelGapPx,
                gridTemplateColumns:
                  previewMode === "sheet"
                    ? `repeat(${gridCols}, ${cellOuterWidthPx}px)`
                    : `repeat(${gridCols}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: gridPreviewCount }).map((_, i) => (
                <div
                  key={i}
                  className="relative box-border transition-[width,height] duration-200"
                  style={{
                    width: previewMode === "sheet" ? cellOuterWidthPx : "100%",
                    minHeight: cellOuterHeightPx,
                    padding: bleedPx,
                    backgroundColor: bleedMm > 0 ? "rgba(251, 238, 221, 0.45)" : undefined,
                    outline: bleedMm > 0 ? "1px dashed rgba(185, 114, 43, 0.35)" : undefined,
                    outlineOffset: -1,
                  }}
                >
                  <div
                    className="relative mx-auto box-border"
                    style={{
                      width: previewMode === "sheet" ? trimWidthPx : "100%",
                      maxWidth: trimWidthPx,
                      minHeight: trimHeightPx,
                    }}
                  >
                    {showCropMarks ? <TrimCropMarks /> : null}
                    {renderLabelCell(i)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
