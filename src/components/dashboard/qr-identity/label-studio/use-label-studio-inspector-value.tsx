"use client"

import { useCallback, useMemo } from "react"
import type { InspectorContextValue } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { LabelPreviewCell } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewCell"
import type { useLabelStudioLayout } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-layout"
import type { useLabelStudioExport } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-export"
import type { LabelStudioWorkflowStatus } from "@/components/dashboard/qr-identity/label-studio/label-studio-workflow-status"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { useToast } from "@/components/ui/Toast"

type Layout = ReturnType<typeof useLabelStudioLayout>
type ExportState = ReturnType<typeof useLabelStudioExport>

export function useLabelStudioInspectorValue(params: {
  layout: Layout
  exportState: ExportState
  exportFormat: string
  setExportFormat: (v: string) => void
  selectedProducts: ProductPrintCandidate[]
  selectedProductIds: string[]
  workflow: LabelStudioWorkflowStatus
}): InspectorContextValue {
  const toast = useToast()
  const {
    layout,
    exportState,
    exportFormat,
    setExportFormat,
    selectedProducts,
    selectedProductIds,
    workflow,
  } = params

  const copyScanLink = useCallback(async () => {
    if (!layout.printPreviewScanUrl) {
      toast.error("Select a product with an active passport first.")
      return
    }
    try {
      await navigator.clipboard.writeText(layout.printPreviewScanUrl)
      toast.success("Scan link copied.")
    } catch {
      toast.error("Could not copy link.")
    }
  }, [layout.printPreviewScanUrl, toast])

  const openScanPreview = useCallback(() => {
    if (!layout.printPreviewScanUrl) {
      toast.error("No passport URL to preview.")
      return
    }
    window.open(layout.printPreviewScanUrl, "_blank", "noopener,noreferrer")
  }, [layout.printPreviewScanUrl, toast])

  const renderLabelCell = useCallback(
    (i: number) => {
      const cycle = Math.max(selectedProducts.length, 1)
      const product = selectedProducts[i % cycle] ?? null
      return (
        <LabelPreviewCell
          product={product}
          face={layout.labelFace}
          previewMode={layout.previewMode}
          branding={layout.branding}
          scanUrl={layout.printPreviewScanUrl}
          compact={layout.previewMode === "sheet"}
        />
      )
    },
    [
      selectedProducts,
      layout.labelFace,
      layout.previewMode,
      layout.branding,
      layout.printPreviewScanUrl,
    ],
  )

  return useMemo(
    (): InspectorContextValue => ({
      studioFieldId: layout.studioFieldId,
      quantityInputId: layout.quantityInputId,
      footerTextInputId: layout.footerTextInputId,
      layoutUnit: layout.layoutUnit,
      setLayoutUnit: layout.setLayoutUnit,
      previewMode: layout.previewMode,
      setPreviewMode: layout.setPreviewMode,
      selectedTemplate: layout.selectedTemplate,
      setTemplateModalOpen: layout.setTemplateModalOpen,
      duplicateCurrentTemplate: layout.duplicateCurrentTemplate,
      openSaveTemplateDialog: layout.openSaveTemplateDialog,
      saveTemplateBlockedReason: layout.saveTemplateBlockedReason,
      templateMutationPending: layout.templateMutationPending,
      marginTop: layout.marginTop,
      marginRight: layout.marginRight,
      marginBottom: layout.marginBottom,
      marginLeft: layout.marginLeft,
      setMarginTop: layout.setMarginTop,
      setMarginRight: layout.setMarginRight,
      setMarginBottom: layout.setMarginBottom,
      setMarginLeft: layout.setMarginLeft,
      marginsLinked: layout.marginsLinked,
      setMarginsLinked: layout.setMarginsLinked,
      setAllMargins: layout.setAllMargins,
      cellWidthMm: layout.cellWidthMm,
      setCellWidthMm: layout.setCellWidthMm,
      cellHeightMm: layout.cellHeightMm,
      setCellHeightMm: layout.setCellHeightMm,
      dimensionsLinked: layout.dimensionsLinked,
      setDimensionsLinked: layout.setDimensionsLinked,
      aspectRatioRef: layout.aspectRatioRef,
      labelGapPx: layout.labelGapPx,
      setLabelGapPx: layout.setLabelGapPx,
      quantity: layout.quantity,
      setQuantity: layout.setQuantity,
      qrStyle: layout.qrStyle,
      setQrStyle: layout.setQrStyle,
      showQrCode: layout.showQrCode,
      setShowQrCode: layout.setShowQrCode,
      showProductName: layout.showProductName,
      setShowProductName: layout.setShowProductName,
      showLogo: layout.showLogo,
      setShowLogo: layout.setShowLogo,
      qrSizeInches: layout.qrSizeInches,
      setQrSizeInches: layout.setQrSizeInches,
      labelTextPt: layout.labelTextPt,
      setLabelTextPt: layout.setLabelTextPt,
      brandColor: layout.brandColor,
      setBrandColor: layout.setBrandColor,
      borderStyle: layout.borderStyle,
      setBorderStyle: layout.setBorderStyle,
      typographyStyle: layout.typographyStyle,
      setTypographyStyle: layout.setTypographyStyle,
      footerText: layout.footerText,
      setFooterText: layout.setFooterText,
      logoDataUrl: layout.logoDataUrl,
      setLogoDataUrl: layout.setLogoDataUrl,
      printPreviewScanUrl: layout.printPreviewScanUrl,
      primaryPassportProduct: layout.primaryPassportProduct,
      copyScanLink,
      openScanPreview,
      bleedMm: layout.bleedMm,
      setBleedMm: layout.setBleedMm,
      dpi: layout.dpi,
      setDpi: layout.setDpi,
      paperSize: layout.paperSize,
      setPaperSize: layout.setPaperSize,
      alignment: layout.alignment,
      setAlignment: layout.setAlignment,
      showCropMarks: layout.showCropMarks,
      setShowCropMarks: layout.setShowCropMarks,
      snapToGrid: layout.snapToGrid,
      setSnapToGrid: layout.setSnapToGrid,
      exportFormat,
      setExportFormat,
      handleExportSelected: exportState.handleExportSelected,
      exportSubmitting: exportState.exportSubmitting,
      printHistory: exportState.printHistory,
      workflow,
      selectedProducts,
      selectedProductIds,
      cellsPerSheet: layout.cellsPerSheet,
      estimatedPages: layout.estimatedPages,
      batchId: layout.batchId,
      renderLabelCell,
    }),
    [
      layout,
      exportFormat,
      setExportFormat,
      exportState,
      selectedProducts,
      selectedProductIds,
      workflow,
      copyScanLink,
      openScanPreview,
      renderLabelCell,
    ],
  )
}
