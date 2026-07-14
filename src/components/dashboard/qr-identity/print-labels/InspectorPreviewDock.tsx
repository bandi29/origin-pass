"use client"

import { useInspector } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { formatLengthFromMm } from "@/components/dashboard/qr-identity/print-labels/layout-utils"

/**
 * Compact text-only summary for the Inspector — the canvas is the live preview.
 */
export function InspectorPreviewDock({ compact = false }: { compact?: boolean }) {
  const {
    selectedTemplate,
    cellWidthMm,
    cellHeightMm,
    layoutUnit,
    cellsPerSheet,
    batchId,
    exportFormat,
    estimatedPages,
  } = useInspector()

  const cellSize = `${formatLengthFromMm(cellWidthMm, layoutUnit)} × ${formatLengthFromMm(cellHeightMm, layoutUnit)}`

  if (compact) {
    return (
      <div className="shrink-0 rounded-xl border border-[#E7E2D7] bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(14,27,42,0.05)]">
        <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-[#15293E]">
          <div className="col-span-2 min-w-0">
            <dt className="text-[10px] text-[#9AA0A8]">Template</dt>
            <dd className="truncate font-semibold">{selectedTemplate?.name ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-[#9AA0A8]">Cell</dt>
            <dd className="truncate font-mono text-[10px] tabular-nums">{cellSize}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-[#9AA0A8]">Per page</dt>
            <dd className="font-semibold tabular-nums">{cellsPerSheet}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-[#9AA0A8]">Pages</dt>
            <dd className="font-semibold tabular-nums">{estimatedPages}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] text-[#9AA0A8]">Export</dt>
            <dd className="truncate font-semibold uppercase">{exportFormat}</dd>
          </div>
        </dl>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#E7E2D7] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(14,27,42,0.05)]">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9AA0A8]">Summary</p>
      <dl className="mt-2 space-y-1.5 text-[13px] text-[#15293E]">
        <div className="flex justify-between gap-3">
          <dt className="text-[#6B7079]">Template</dt>
          <dd className="truncate text-right font-semibold">{selectedTemplate?.name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#6B7079]">Cell size</dt>
          <dd className="font-mono text-right text-xs tabular-nums">{cellSize}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#6B7079]">Per page</dt>
          <dd className="text-right font-semibold tabular-nums">{cellsPerSheet} labels</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#6B7079]">Est. pages</dt>
          <dd className="text-right font-semibold tabular-nums">{estimatedPages}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#6B7079]">Batch</dt>
          <dd className="font-mono text-right text-xs">#{batchId ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-2.5 border-t border-[#EFEBE2] pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#27543D]">
        Export · {exportFormat}
      </p>
    </div>
  )
}
