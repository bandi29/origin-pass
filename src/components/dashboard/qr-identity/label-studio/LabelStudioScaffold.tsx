"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import clsx from "clsx"
import { LabelStudioProgressRail } from "@/components/dashboard/qr-identity/label-studio/LabelStudioProgressRail"
import { LabelStudioActionBar } from "@/components/dashboard/qr-identity/label-studio/LabelStudioActionBar"
import { LabelStudioProductsRail } from "@/components/dashboard/qr-identity/label-studio/LabelStudioProductsRail"
import { LabelStudioCanvas } from "@/components/dashboard/qr-identity/label-studio/LabelStudioCanvas"
import { LabelStudioInspectorColumn } from "@/components/dashboard/qr-identity/label-studio/LabelStudioInspectorColumn"
import { LabelStudioTemplateModal } from "@/components/dashboard/qr-identity/label-studio/LabelStudioTemplateModal"
import { SaveLayoutTemplateDialog } from "@/components/dashboard/qr-identity/label-studio/SaveLayoutTemplateDialog"
import { useLabelStudioLayoutTemplates } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-layout-templates"
import { useLabelStudioExport } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-export"
import { useLabelStudioInspectorValue } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-inspector-value"
import { LabelStudioProductPickerDrawer } from "@/components/dashboard/qr-identity/label-studio/LabelStudioProductPickerDrawer"
import { useLabelStudioSelection } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-selection"
import { useLabelStudioLayout } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-layout"
import { useLabelStudioBrowserPrint } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-browser-print"
import {
  STUDIO_INSPECTOR_HIDE_MAX,
  STUDIO_RAIL_COLLAPSE_MAX,
} from "@/components/dashboard/qr-identity/label-studio/constants"
import { useMediaQuery } from "@/components/dashboard/qr-identity/label-studio/use-media-query"
import { deriveLabelStudioWorkflowStatus } from "@/components/dashboard/qr-identity/label-studio/label-studio-workflow-status"
import { useStudioProgress } from "@/components/dashboard/qr-identity/label-studio/use-studio-progress"
import type { LabelStudioInspectorTab, LabelStudioStepId } from "@/components/dashboard/qr-identity/label-studio/types"
import type { LabelPrintStudioPayload } from "@/lib/label-print-studio-server-data"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"

function stepToInspectorTab(step: LabelStudioStepId): LabelStudioInspectorTab | null {
  if (step === "layout") return "layout"
  if (step === "branding") return "branding"
  if (step === "destination") return "destination"
  if (step === "export") return "output"
  return null
}

export function LabelStudioScaffold({ payload }: { payload: LabelPrintStudioPayload }) {
  const railCollapseMq = useMediaQuery(`(max-width: ${STUDIO_RAIL_COLLAPSE_MAX}px)`)
  const inspectorHideMq = useMediaQuery(`(max-width: ${STUDIO_INSPECTOR_HIDE_MAX}px)`)

  const {
    selectedProducts,
    selectedProductIds,
    filteredCatalog,
    productSearch,
    setProductSearch,
    verifiedOnly,
    setVerifiedOnly,
    activeOnly,
    setActiveOnly,
    batchOnly,
    setBatchOnly,
    toggleProduct,
    removeProduct,
    isSelected,
  } = useLabelStudioSelection(payload.products)

  const [exportFormat, setExportFormat] = useState("pdf")
  const templatesApi = useLabelStudioLayoutTemplates()
  const layout = useLabelStudioLayout(payload, selectedProducts, {
    exportFormat,
    setExportFormat,
    templatesApi,
    canPersistTemplates: true,
  })
  const workflow = useMemo(
    () => deriveLabelStudioWorkflowStatus(selectedProducts),
    [selectedProducts],
  )

  const exportState = useLabelStudioExport({
    payload,
    selectedProductIds,
    selectedTemplate: layout.selectedTemplate,
    previewMode: layout.previewMode,
    quantity: layout.quantity,
    exportFormat,
    exportPrintReady: workflow.exportPrintReady,
    exportPrintBlockedReason: workflow.exportPrintBlockedReason,
  })
  const inspectorValue = useLabelStudioInspectorValue({
    layout,
    exportState,
    exportFormat,
    setExportFormat,
    selectedProducts,
    selectedProductIds,
    workflow,
  })

  const [activeStepId, setActiveStepId] = useState<LabelStudioStepId>("layout")
  const [inspectorTab, setInspectorTab] = useState<LabelStudioInspectorTab>("layout")
  const { steps: progressSteps, readyCount, totalSteps } = useStudioProgress({
    selectedProductIds,
    selectedTemplate: layout.selectedTemplate,
    cellWidthMm: layout.cellWidthMm,
    cellHeightMm: layout.cellHeightMm,
    destinationReady: workflow.destinationReady,
    hasSelection: workflow.hasSelection,
    hasPassportAmongSelection: workflow.hasPassportAmongSelection,
    currentStepId: activeStepId,
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false)
  const [railManualExpanded, setRailManualExpanded] = useState(false)
  const pickerReturnFocusRef = useRef<HTMLElement | null>(null)
  const inspectorReturnFocusRef = useRef<HTMLElement | null>(null)
  const printContentRef = useRef<HTMLDivElement>(null)
  const handleBrowserPrint = useLabelStudioBrowserPrint(printContentRef)

  const openProductPicker = useCallback((trigger?: HTMLElement | null) => {
    pickerReturnFocusRef.current =
      trigger ??
      (typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)
    setPickerOpen(true)
  }, [])

  const openInspectorSheet = useCallback((trigger?: HTMLElement | null) => {
    inspectorReturnFocusRef.current =
      trigger ??
      (typeof document !== "undefined" && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)
    setInspectorSheetOpen(true)
  }, [])
  const selectionCount = workflow.selectionCount
  const railCollapsed = railCollapseMq && !railManualExpanded

  const handleInspectorTab = useCallback((tab: LabelStudioInspectorTab) => {
    setInspectorTab(tab)
    setActiveStepId(tab === "output" ? "export" : tab)
  }, [])

  const handleStepSelect = useCallback(
    (id: LabelStudioStepId, trigger?: HTMLElement | null) => {
      setActiveStepId(id)
      if (id === "products") {
        openProductPicker(trigger)
        return
      }
      const tab = stepToInspectorTab(id)
      if (tab) {
        handleInspectorTab(tab)
        if (inspectorHideMq) openInspectorSheet(trigger)
      }
    },
    [handleInspectorTab, inspectorHideMq, openProductPicker, openInspectorSheet],
  )

  const handleToggleRail = useCallback(() => {
    if (railCollapseMq) setRailManualExpanded((v) => !v)
  }, [railCollapseMq])

  useEffect(() => {
    if (layout.templateModalOpen) void templatesApi.refetch()
  }, [layout.templateModalOpen, templatesApi.refetch])

  // Fill exactly from the studio's top edge to the viewport bottom — no empty band
  // below the action bar, regardless of how tall the dashboard chrome above is. The
  // CSS `100dvh - Xrem` classes below remain as a no-JS / pre-hydration fallback.
  const rootRef = useRef<HTMLDivElement>(null)
  const [fillHeight, setFillHeight] = useState<number | null>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof window === "undefined") return
    const measure = () => {
      // Distance from the studio's own top edge to the viewport bottom — fills
      // exactly, no empty band, regardless of how tall the chrome above ends up.
      const top = el.getBoundingClientRect().top
      setFillHeight(Math.max(360, Math.round(window.innerHeight - top)))
    }
    measure()
    // Re-measure across the first few frames so async/Suspense chrome above
    // (breadcrumbs, trust strip) that shifts our top edge is accounted for.
    const rafs = [
      requestAnimationFrame(measure),
      requestAnimationFrame(() => requestAnimationFrame(measure)),
    ]
    const settle = window.setTimeout(measure, 250)
    window.addEventListener("resize", measure)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    // Observing <body> catches layout shifts anywhere above us without polling.
    ro?.observe(document.body)
    if (el.parentElement) ro?.observe(el.parentElement)
    return () => {
      rafs.forEach((id) => cancelAnimationFrame(id))
      window.clearTimeout(settle)
      window.removeEventListener("resize", measure)
      ro?.disconnect()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      style={fillHeight != null ? { height: fillHeight, maxHeight: fillHeight } : undefined}
      className={clsx(
        "label-studio-root relative mx-auto flex w-full flex-col overflow-hidden",
        "min-h-0 min-w-0",
        /* Fill the entire content area (escape the max-w-6xl page column) on lg+.
           Width = wide-container cap (1720px) or viewport, minus sidebar(16rem)
           + nav gap(2rem) + container gutters(3rem) ≈ 21rem, plus 0.5rem buffer.
           This exactly matches the flex-1 content column → no horizontal page scroll. */
        "lg:w-[calc(min(1720px,100vw)-21.5rem)]",
        /* Fallback before JS measures the exact fill height (see effect above). */
        "h-[calc(100dvh-8rem)] max-h-[calc(100dvh-8rem)]",
        "md:h-[calc(100dvh-6.5rem)] md:max-h-[calc(100dvh-6.5rem)]",
        "lg:h-[calc(100dvh-4.5rem)] lg:max-h-[calc(100dvh-4.5rem)]",
      )}
    >
      <div className="z-10 shrink-0 border-b border-[#E7E2D7] bg-[#FCFBF8]/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-[#FCFBF8]/85">
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 sm:px-6">
          <h1 className="font-serif text-lg font-semibold tracking-tight text-[#0E1B2A] md:text-xl">
            Label Studio
          </h1>
          <p className="text-[13px] text-[#6B7079] max-sm:w-full">
            Create print-ready QR labels and product tags.
          </p>
        </header>
        <LabelStudioProgressRail
          steps={progressSteps}
          readyCount={readyCount}
          totalSteps={totalSteps}
          onStepSelect={handleStepSelect}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <LabelStudioProductsRail
            collapsed={railCollapsed}
            onToggleCollapse={handleToggleRail}
            onOpenPicker={openProductPicker}
            selectedProducts={selectedProducts}
            onRemoveProduct={removeProduct}
          />

          <LabelStudioCanvas
            selectedProducts={selectedProducts}
            selectionCount={selectionCount}
            printContentRef={printContentRef}
            onOpenPicker={openProductPicker}
            inspectorHidden={inspectorHideMq}
            onOpenInspector={openInspectorSheet}
            previewMode={layout.previewMode}
            previewZoom={layout.previewZoom}
            onZoomOut={layout.zoomOut}
            onZoomIn={layout.zoomIn}
            cellWidthMm={layout.cellWidthMm}
            cellHeightMm={layout.cellHeightMm}
            marginTop={layout.marginTop}
            marginRight={layout.marginRight}
            marginBottom={layout.marginBottom}
            marginLeft={layout.marginLeft}
            labelGapPx={layout.labelGapPx}
            gridCols={layout.gridCols}
            gridPreviewCount={layout.gridPreviewCount}
            snapToGrid={layout.snapToGrid}
            bleedMm={layout.bleedMm}
            showCropMarks={layout.showCropMarks}
            branding={layout.branding}
            printPreviewScanUrl={layout.printPreviewScanUrl}
            labelFace={layout.labelFace}
            onLabelFaceChange={layout.setLabelFace}
            showFaceToggle={layout.showFaceToggle}
            selectedTemplate={layout.selectedTemplate}
            sheetCapacity={layout.sheetGrid.capacity}
            sheetRows={layout.sheetGrid.rows}
          />

          {!inspectorHideMq ? (
            <LabelStudioInspectorColumn
              value={inspectorValue}
              activeTab={inspectorTab}
              onTabChange={handleInspectorTab}
            />
          ) : null}
        </div>

        <div className="z-10 shrink-0 border-t border-[#E7E2D7] bg-[#FCFBF8]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#FCFBF8]/85">
          <LabelStudioActionBar
            selectionCount={selectionCount}
            estimatedPages={layout.estimatedPages}
            previewMode={layout.previewMode}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            exportPrintReady={workflow.exportPrintReady}
            exportPrintBlockedReason={workflow.exportPrintBlockedReason}
            onExport={() => void exportState.submitJob("export")}
            onPrint={() => {
              if (!workflow.exportPrintReady) return
              handleBrowserPrint()
            }}
            isSubmitting={exportState.exportSubmitting}
          />
        </div>
      </div>

      <LabelStudioProductPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        returnFocusRef={pickerReturnFocusRef}
        products={payload.products}
        filteredProducts={filteredCatalog}
        productSearch={productSearch}
        onProductSearchChange={setProductSearch}
        verifiedOnly={verifiedOnly}
        onVerifiedOnlyChange={setVerifiedOnly}
        activeOnly={activeOnly}
        onActiveOnlyChange={setActiveOnly}
        batchOnly={batchOnly}
        onBatchOnlyChange={setBatchOnly}
        isSelected={isSelected}
        onToggleProduct={toggleProduct}
        selectionCount={selectionCount}
      />

      <Sheet open={inspectorSheetOpen} onOpenChange={setInspectorSheetOpen}>
        <SheetContent
          className="flex w-full max-w-md flex-col bg-gradient-to-b from-[#FCFBF8] to-[#F7F4EE] p-0 sm:max-w-lg"
          onCloseAutoFocus={(event) => {
            const el = inspectorReturnFocusRef.current
            if (el?.isConnected) {
              event.preventDefault()
              el.focus()
            }
          }}
        >
          <div className="border-b border-[#E7E2D7] px-5 py-4">
            <SheetTitle className="font-serif text-lg font-semibold text-[#0E1B2A]">Inspector</SheetTitle>
            <SheetDescription className="text-sm text-[#6B7079]">
              Narrow view — same tabs as the desktop inspector column.
            </SheetDescription>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LabelStudioInspectorColumn
              value={inspectorValue}
              embedded
              activeTab={inspectorTab}
              onTabChange={handleInspectorTab}
            />
          </div>
        </SheetContent>
      </Sheet>

      <LabelStudioTemplateModal
        open={layout.templateModalOpen}
        onClose={() => layout.setTemplateModalOpen(false)}
        templates={layout.visualTemplates}
        selectedTemplateId={layout.selectedTemplateId}
        onSelect={layout.setSelectedTemplateId}
        customLoading={layout.customTemplatesLoading}
        customError={layout.customTemplatesError}
        mutationPending={layout.templateMutationPending}
        onRenameTemplate={(id, name) => {
          const target = layout.visualTemplates.find((t) => t.id === id)
          return layout.renameTemplate(id, name, target?.description ?? null)
        }}
        onUpdateTemplateLayout={layout.updateTemplateLayoutById}
        onDeleteTemplate={layout.deleteTemplate}
      />

      <SaveLayoutTemplateDialog
        open={layout.saveDialogOpen}
        onOpenChange={layout.setSaveDialogOpen}
        defaultName={layout.saveDialogDefaultName}
        blockedReason={layout.saveTemplateBlockedReason}
        isSaving={layout.templateMutationPending}
        onSave={layout.saveTemplateWithMeta}
      />
    </div>
  )
}
