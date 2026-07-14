"use client"

import clsx from "clsx"
import { Crop, Grid3x3, Layers3 } from "lucide-react"
import { useInspector } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { StudioValuePopover } from "@/components/dashboard/qr-identity/print-labels/inspector-shared"
import { StudioNativeSelect } from "@/components/ui/StudioNativeSelect"
import { PrintHistoryPanel } from "@/components/dashboard/qr-identity/print-labels/PrintHistoryPanel"
import { ExportCenterPanel } from "@/components/dashboard/qr-identity/print-labels/ExportCenterPanel"
import { formatLengthFromMm, printJobStatusLabel } from "@/components/dashboard/qr-identity/print-labels/layout-utils"
import { STUDIO_LABEL } from "@/components/dashboard/qr-identity/print-labels/constants"

const TOGGLE_BASE = "inline-flex h-9 w-9 items-center justify-center rounded-sm border transition"
const toggleCls = (on: boolean) =>
  clsx(TOGGLE_BASE, on ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300")

export function OutputTab() {
  const {
    studioFieldId,
    layoutUnit,
    bleedMm,
    setBleedMm,
    dpi,
    setDpi,
    paperSize,
    setPaperSize,
    alignment,
    setAlignment,
    showCropMarks,
    setShowCropMarks,
    snapToGrid,
    setSnapToGrid,
    exportFormat,
    exportSubmitting,
    printHistory,
    workflow,
  } = useInspector()

  const latestJobStatus = printHistory[0] ? printJobStatusLabel(printHistory[0].status) : null

  return (
    <div className="space-y-4">
      {/* Advanced printing */}
      <div className="border-t border-ds-border pt-3">
        <p className={`${STUDIO_LABEL} mb-2 flex items-center gap-1.5`}>
          <Layers3 className="h-3.5 w-3.5 text-slate-400" />
          Advanced printing
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StudioValuePopover variant="iconOnly" icon={Layers3} label="Bleed width" valueDisplay={formatLengthFromMm(bleedMm, layoutUnit)} alignPopover="left">
            <input type="range" min={0} max={8} step={1} value={bleedMm} onChange={(e) => setBleedMm(Number(e.target.value))} className="w-full accent-brand" />
            <p className="mt-2 text-center text-[10px] tabular-nums text-slate-500">{formatLengthFromMm(bleedMm, layoutUnit)}</p>
          </StudioValuePopover>
          <div>
            <label htmlFor={`${studioFieldId}-dpi`} className={STUDIO_LABEL}>
              DPI
            </label>
            <StudioNativeSelect wrapClassName="mt-1" id={`${studioFieldId}-dpi`} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} title="Print resolution">
              <option value={150}>150 draft</option>
              <option value={300}>300 production</option>
              <option value={600}>600 fine</option>
            </StudioNativeSelect>
          </div>
          <div>
            <label htmlFor={`${studioFieldId}-paper`} className={STUDIO_LABEL}>
              Paper
            </label>
            <StudioNativeSelect wrapClassName="mt-1" id={`${studioFieldId}-paper`} value={paperSize} onChange={(e) => setPaperSize(e.target.value)} title="Paper size">
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
              <option value="legal">Legal</option>
            </StudioNativeSelect>
          </div>
          <div>
            <label htmlFor={`${studioFieldId}-align`} className={STUDIO_LABEL}>
              Align
            </label>
            <StudioNativeSelect wrapClassName="mt-1" id={`${studioFieldId}-align`} value={alignment} onChange={(e) => setAlignment(e.target.value)} title="Vertical alignment">
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </StudioNativeSelect>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            title={showCropMarks ? "Hide crop marks on preview" : "Show crop marks on preview"}
            aria-label={showCropMarks ? "Hide crop marks on preview" : "Show crop marks on preview"}
            aria-pressed={showCropMarks}
            onClick={() => setShowCropMarks((current) => !current)}
            className={toggleCls(showCropMarks)}
          >
            <Crop className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" title="Snap layout to grid" aria-label="Snap layout to grid" aria-pressed={snapToGrid} onClick={() => setSnapToGrid((v) => !v)} className={toggleCls(snapToGrid)}>
            <Grid3x3 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Export center status */}
      <div className="border-t border-ds-border pt-3">
        <ExportCenterPanel
          selectedCount={workflow.selectionCount}
          exportFormat={exportFormat}
          isSubmitting={exportSubmitting}
          latestJobStatus={latestJobStatus}
        />
      </div>

      {/* Print history */}
      <div className="border-t border-ds-border pt-3">
        <PrintHistoryPanel jobs={printHistory} />
      </div>

      <p className="border-t border-ds-border pt-3 text-[11px] leading-relaxed text-ds-text-muted">
        Immutable QR linking, signed URLs, anti-copy encoding, and audit-ready generation logs.
      </p>
    </div>
  )
}
