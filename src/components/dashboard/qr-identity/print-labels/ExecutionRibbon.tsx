"use client"

import clsx from "clsx"
import { Download, Printer } from "lucide-react"
import { StudioNativeSelect } from "@/components/ui/StudioNativeSelect"
import { NAVY, QUEUE_DISABLED_TOOLTIP } from "@/components/dashboard/qr-identity/print-labels/constants"
import { previewModeChipLabel } from "@/components/dashboard/qr-identity/print-labels/layout-utils"

const DISABLED_ACTION =
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"

type ExecutionRibbonProps = {
  selectedProductIds: string[]
  estimatedPages: number
  exportFormat: string
  previewMode: string
  onExportFormatChange: (format: string) => void
  onExport: () => void
  onPrint: () => void
  isSubmitting?: boolean
}

export function ExecutionRibbon({
  selectedProductIds,
  estimatedPages,
  exportFormat,
  previewMode,
  onExportFormatChange,
  onExport,
  onPrint,
  isSubmitting = false,
}: ExecutionRibbonProps) {
  const selectionCount = selectedProductIds.length
  const hasSelection = selectionCount > 0
  const exportLabel = `Export ${exportFormat.toUpperCase()}`
  const layoutChipLabel = previewModeChipLabel(previewMode)
  const actionsLocked = selectionCount === 0 || isSubmitting

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-slate-200/90 bg-white/90 px-4 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/75 md:px-8"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-normal text-slate-700">
          <span
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold leading-normal ring-1 transition-colors",
              hasSelection
                ? "bg-brand/5 text-brand ring-brand/15"
                : "bg-slate-100 text-slate-500 ring-slate-200",
            )}
          >
            <span
              className={clsx("h-1.5 w-1.5 rounded-full", hasSelection ? "bg-emerald-500" : "bg-slate-400")}
              aria-hidden
            />
            {selectionCount} label{selectionCount === 1 ? "" : "s"} selected
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
          <span className="leading-normal text-slate-600">
            Est. {estimatedPages} page{estimatedPages === 1 ? "" : "s"}
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
            Layout · {layoutChipLabel}
          </span>
          <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-medium leading-normal text-slate-600">Format</span>
            <StudioNativeSelect
              wrapClassName="w-auto min-w-[6.5rem] shrink-0"
              value={exportFormat}
              onChange={(e) => onExportFormatChange(e.target.value)}
              aria-label="Export format"
            >
              <option value="pdf">PDF</option>
              <option value="svg">SVG</option>
              <option value="png">PNG</option>
              <option value="zip">ZIP</option>
            </StudioNativeSelect>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex flex-1 sm:flex-none"
            title={!hasSelection ? QUEUE_DISABLED_TOOLTIP : undefined}
          >
            <button
              type="button"
              disabled={selectionCount === 0 || isSubmitting}
              aria-disabled={actionsLocked}
              onClick={(e) => {
                e.preventDefault()
                if (actionsLocked) return
                onExport()
              }}
              className={clsx(
                "inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium leading-normal shadow-sm transition sm:w-auto",
                DISABLED_ACTION,
                hasSelection && !isSubmitting
                  ? "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-50 text-slate-400 shadow-none",
              )}
            >
              <Download
                className={clsx("mr-2 h-4 w-4", hasSelection ? "text-slate-600" : "text-slate-400")}
                aria-hidden
              />
              {exportLabel}
            </button>
          </span>
          <span
            className="inline-flex flex-1 sm:flex-none"
            title={!hasSelection ? QUEUE_DISABLED_TOOLTIP : undefined}
          >
            <button
              type="button"
              disabled={selectionCount === 0 || isSubmitting}
              aria-disabled={actionsLocked}
              onClick={(e) => {
                e.preventDefault()
                if (actionsLocked) return
                onPrint()
              }}
              className={clsx(
                "inline-flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold leading-normal transition duration-200 sm:w-auto",
                DISABLED_ACTION,
                hasSelection && !isSubmitting
                  ? "text-white shadow-md hover:scale-[1.02] hover:shadow-lg"
                  : "bg-slate-100 text-slate-400 shadow-none",
              )}
              style={hasSelection && !isSubmitting ? { backgroundColor: NAVY } : undefined}
            >
              <Printer
                className={clsx("mr-2 h-4 w-4", hasSelection ? "text-white" : "text-slate-400")}
                aria-hidden
              />
              Print
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
