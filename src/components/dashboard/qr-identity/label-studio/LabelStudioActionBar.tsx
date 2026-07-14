"use client"

import clsx from "clsx"
import { Download, Printer } from "lucide-react"
import { StudioNativeSelect } from "@/components/ui/StudioNativeSelect"
import { previewModeChipLabel } from "@/components/dashboard/qr-identity/print-labels/layout-utils"
import { STUDIO_INK } from "@/components/dashboard/qr-identity/label-studio/constants"

const DISABLED_ACTION =
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"

function selectionChipLabel(count: number): string {
  return `${count} label${count === 1 ? "" : "s"} selected`
}

export function LabelStudioActionBar({
  selectionCount = 0,
  estimatedPages = 1,
  previewMode = "single",
  exportFormat = "pdf",
  onExportFormatChange,
  exportPrintReady = false,
  exportPrintBlockedReason = null,
  onExport,
  onPrint,
  isSubmitting = false,
}: {
  selectionCount?: number
  estimatedPages?: number
  previewMode?: string
  exportFormat?: string
  onExportFormatChange?: (format: string) => void
  exportPrintReady?: boolean
  exportPrintBlockedReason?: string | null
  onExport?: () => void
  onPrint?: () => void
  isSubmitting?: boolean
}) {
  const hasSelection = selectionCount > 0
  const exportLocked = !exportPrintReady || isSubmitting
  const printLocked = !exportPrintReady
  const disabledReason = exportPrintBlockedReason ?? undefined
  const exportLabel = `Export ${exportFormat.toUpperCase()}`
  const layoutChipLabel = previewModeChipLabel(previewMode)

  return (
    <div
      className="shrink-0 border-t border-[#E7E2D7] bg-white/95 px-4 py-3 shadow-[0_-6px_24px_rgba(14,27,42,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80 sm:px-6"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      role="region"
      aria-label="Export and print actions"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#6B7079]">
          <span
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1",
              hasSelection
                ? "bg-[#E7F0EA] text-[#27543D] ring-[#356B4E]/20"
                : "bg-[#F1EEE7] text-[#6B7079] ring-[#E7E2D7]",
            )}
          >
            <span
              className={clsx("h-1.5 w-1.5 rounded-full", hasSelection ? "bg-[#356B4E]" : "bg-[#D8D3C7]")}
              aria-hidden
            />
            {selectionChipLabel(selectionCount)}
          </span>
          <span className="hidden h-4 w-px bg-[#E7E2D7] sm:block" aria-hidden />
          <span>
            Est. {estimatedPages} page{estimatedPages === 1 ? "" : "s"}
          </span>
          <span className="hidden h-4 w-px bg-[#E7E2D7] sm:block" aria-hidden />
          <span className="rounded-full bg-[#F1EEE7] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6B7079] ring-1 ring-[#E7E2D7]">
            Layout · {layoutChipLabel}
          </span>
          <span className="hidden h-4 w-px bg-[#E7E2D7] sm:block" aria-hidden />
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-medium text-[#6B7079]">Format</span>
            <StudioNativeSelect
              wrapClassName="w-auto min-w-[6.5rem] shrink-0"
              value={exportFormat}
              onChange={(e) => onExportFormatChange?.(e.target.value)}
              aria-label="Export format"
            >
              <option value="pdf">PDF</option>
              <option value="svg">SVG</option>
              <option value="png">PNG</option>
              <option value="zip">ZIP</option>
            </StudioNativeSelect>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex flex-1 sm:flex-none" title={disabledReason}>
            <button
              type="button"
              disabled={exportLocked}
              aria-disabled={exportLocked}
              aria-describedby={exportLocked && disabledReason ? "label-studio-export-blocked" : undefined}
              onClick={onExport}
              className={clsx(
                "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium sm:w-auto",
                DISABLED_ACTION,
                exportPrintReady && !isSubmitting
                  ? "border-[#E7E2D7] bg-white text-[#15293E] hover:border-[#15293E]"
                  : "border-[#E7E2D7] bg-[#F7F4EE] text-[#9AA0A8]",
              )}
            >
              <Download className="h-4 w-4" aria-hidden />
              {exportLabel}
            </button>
          </span>
          <span className="inline-flex flex-1 sm:flex-none" title={disabledReason}>
            <button
              type="button"
              disabled={printLocked}
              aria-disabled={printLocked}
              aria-describedby={printLocked && disabledReason ? "label-studio-print-blocked" : undefined}
              onClick={onPrint}
              className={clsx(
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white sm:w-auto",
                DISABLED_ACTION,
                exportPrintReady ? "hover:bg-[#15293E]" : "text-white/60",
              )}
              style={
                exportPrintReady ? { backgroundColor: STUDIO_INK } : { backgroundColor: "#9AA0A8" }
              }
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
          </span>
        </div>
      </div>
      {printLocked && disabledReason ? (
        <p id="label-studio-print-blocked" className="sr-only">
          {disabledReason}
        </p>
      ) : null}
      {exportLocked && disabledReason ? (
        <p id="label-studio-export-blocked" className="sr-only">
          {disabledReason}
        </p>
      ) : null}
    </div>
  )
}
