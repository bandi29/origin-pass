"use client"

import { useCallback, useState } from "react"
import type { LabelPrintStudioPayload } from "@/lib/label-print-studio-server-data"
import type { PrintJobRow } from "@/lib/label-print-studio-server-data"
import type { PreviewMode, VisualTemplate } from "@/components/dashboard/qr-identity/print-labels/types"
import {
  createOptimisticPrintJob,
  queueLabelStudioJob,
} from "@/lib/labels/print-studio-export-client"
import { useToast } from "@/components/ui/Toast"

export function useLabelStudioExport(params: {
  payload: LabelPrintStudioPayload
  selectedProductIds: string[]
  selectedTemplate: VisualTemplate
  previewMode: PreviewMode
  quantity: number
  exportFormat: string
  exportPrintReady: boolean
  exportPrintBlockedReason: string | null
}) {
  const toast = useToast()
  const [printHistory, setPrintHistory] = useState<PrintJobRow[]>(params.payload.jobs)
  const [exportSubmitting, setExportSubmitting] = useState(false)

  const labelCount = params.selectedProductIds.length * params.quantity

  const submitJob = useCallback(
    async (action: "export" | "print") => {
      if (!params.exportPrintReady) {
        toast.error(
          params.exportPrintBlockedReason ??
            "Complete destination setup before exporting or printing.",
        )
        return
      }
      setExportSubmitting(true)
      try {
        const { job } = await queueLabelStudioJob({
          action,
          format: params.exportFormat,
          templateId: params.selectedTemplate.id,
          templateName: params.selectedTemplate.name,
          productIds: params.selectedProductIds,
          labelCount,
          layoutMode: params.previewMode,
        })
        setPrintHistory((prev) => [job, ...prev])
        toast.success(
          action === "print" ? "Print job queued." : `${params.exportFormat.toUpperCase()} export queued.`,
        )
      } catch (e) {
        const optimistic = createOptimisticPrintJob({
          action,
          format: params.exportFormat,
          templateId: params.selectedTemplate.id,
          templateName: params.selectedTemplate.name,
          productIds: params.selectedProductIds,
          labelCount,
          layoutMode: params.previewMode,
        })
        setPrintHistory((prev) => [optimistic, ...prev])
        toast.error(
          e instanceof Error ? e.message : "Queue unavailable — saved locally for retry.",
        )
      } finally {
        setExportSubmitting(false)
      }
    },
    [
      params.exportPrintReady,
      params.exportPrintBlockedReason,
      params.selectedProductIds,
      params.exportFormat,
      params.selectedTemplate,
      labelCount,
      params.previewMode,
      toast,
    ],
  )

  const handleExportSelected = useCallback(() => {
    void submitJob("export")
  }, [submitJob])

  return {
    printHistory,
    exportSubmitting,
    handleExportSelected,
    submitJob,
  }
}
