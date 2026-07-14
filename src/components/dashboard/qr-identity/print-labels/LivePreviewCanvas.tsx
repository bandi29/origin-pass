"use client"

import type { ReactNode } from "react"
import { LabelPreviewStage } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewStage"
import type { PreviewMode } from "@/components/dashboard/qr-identity/print-labels/types"

export type LivePreviewCanvasProps = {
  previewMode: PreviewMode
  previewZoom: 50 | 75 | 100
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
  showCropMarks: boolean
  renderLabelCell: (index: number) => ReactNode
  headerToolbar?: ReactNode
  footerControls?: ReactNode
}

export function LivePreviewCanvas({
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
  showCropMarks,
  renderLabelCell,
  headerToolbar,
  footerControls,
}: LivePreviewCanvasProps) {
  return (
    <section className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:px-5">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-slate-900">Label Studio</span>
        </div>
        {headerToolbar ? (
          <div className="min-w-0 flex-1 sm:flex sm:justify-center">{headerToolbar}</div>
        ) : null}
      </header>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
        <span className="h-6 w-0.5 shrink-0 rounded-full bg-indigo-600" aria-hidden />
        <h2 className="text-base font-bold tracking-tight text-slate-900">Live Preview</h2>
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {cellWidthMm.toFixed(1)}×{cellHeightMm.toFixed(1)} mm cell
        </span>
      </div>
      <div className="flex w-full flex-col items-center justify-center bg-slate-50/80 px-4 py-10 sm:py-12">
        <div className="flex w-full max-w-full flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-slate-100 py-10 sm:py-14">
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
            showCropMarks={showCropMarks}
            renderLabelCell={renderLabelCell}
            className="max-h-[80vh] w-full px-3 sm:px-6"
          />
        </div>
      </div>
      {footerControls}
    </section>
  )
}
