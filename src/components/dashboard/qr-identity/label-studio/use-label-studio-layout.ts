"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import type { LabelPrintStudioPayload } from "@/lib/label-print-studio-server-data"
import type { LabelPreviewBranding } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewCell"
import {
  buildVisualTemplates,
  FALLBACK_VISUAL_TEMPLATE,
} from "@/components/dashboard/qr-identity/print-labels/visual-templates"
import {
  computeSheetGrid,
  previewCellCount,
} from "@/components/dashboard/qr-identity/print-labels/sheet-layout-math"
import type {
  LayoutUnit,
  PreviewMode,
  QrStyleId,
  VisualTemplate,
} from "@/components/dashboard/qr-identity/print-labels/types"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import type { PersistedVisualTemplate } from "@/lib/labels/layout-template-types"
import {
  applyLayoutSnapshot,
  buildLayoutSnapshot,
  defaultFallbackTemplateId,
  suggestSaveTemplateName,
  uniquifyTemplateName,
  type LayoutSnapshotSource,
} from "@/lib/labels/layout-template-snapshot"
import { prepareLogoForTemplateSnapshot } from "@/lib/labels/logo-snapshot-utils"
import type { LabelStudioLayoutTemplatesApi } from "@/components/dashboard/qr-identity/label-studio/use-label-studio-layout-templates"
import { useToast } from "@/components/ui/Toast"

const ZOOM_STEPS = [50, 75, 100, 125, 150] as const
export type PreviewZoom = (typeof ZOOM_STEPS)[number]

const DEFAULT_BRANDING: LabelPreviewBranding = {
  qrStyle: "classic",
  brandColor: "#0E1B2A",
  borderStyle: "premium",
  typographyStyle: "serif",
  footerText: "Verified with OriginPass",
  showLogo: true,
  showQrCode: true,
  showProductName: true,
  qrSizeInches: 0.75,
  labelTextPt: 11,
}

function normalizePaperSize(value: string): string {
  const v = value.trim().toLowerCase()
  if (v === "a4") return "a4"
  if (v === "letter" || v === "us letter") return "letter"
  if (v === "legal") return "legal"
  return v || "a4"
}

function isPersistedCustom(t: VisualTemplate | null | undefined): t is PersistedVisualTemplate {
  return Boolean(t?.isCustom && t.layoutSnapshot)
}

export function useLabelStudioLayout(
  payload: LabelPrintStudioPayload,
  selectedProducts: ProductPrintCandidate[],
  options: {
    exportFormat: string
    setExportFormat: (v: string) => void
    templatesApi: LabelStudioLayoutTemplatesApi
    canPersistTemplates: boolean
  },
) {
  const toast = useToast()
  const { exportFormat, setExportFormat, templatesApi, canPersistTemplates } = options

  const studioFieldId = useId()
  const quantityInputId = `${studioFieldId}-qty`
  const footerTextInputId = `${studioFieldId}-footer`
  const aspectRatioRef = useRef(50 / 90)

  const systemVisualTemplates = useMemo(
    () => buildVisualTemplates(payload.templates),
    [payload.templates],
  )

  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => systemVisualTemplates[0]?.id ?? FALLBACK_VISUAL_TEMPLATE.id,
  )
  const [previewMode, setPreviewMode] = useState<PreviewMode>("single")
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>(100)
  const [labelFace, setLabelFace] = useState<"front" | "back">("front")
  const [layoutUnit, setLayoutUnit] = useState<LayoutUnit>("mm")

  const [marginTop, setMarginTop] = useState(10)
  const [marginRight, setMarginRight] = useState(10)
  const [marginBottom, setMarginBottom] = useState(10)
  const [marginLeft, setMarginLeft] = useState(10)
  const [marginsLinked, setMarginsLinked] = useState(true)
  const [cellWidthMm, setCellWidthMm] = useState(50)
  const [cellHeightMm, setCellHeightMm] = useState(90)
  const [dimensionsLinked, setDimensionsLinked] = useState(true)
  const [labelGapPx, setLabelGapPx] = useState(8)
  const [paperSize, setPaperSizeState] = useState("a4")
  const [quantity, setQuantity] = useState(1)
  const [bleedMm, setBleedMm] = useState(2)
  const [dpi, setDpi] = useState(300)
  const [alignment, setAlignment] = useState("center")
  const [showCropMarks, setShowCropMarks] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [branding, setBranding] = useState<LabelPreviewBranding>(DEFAULT_BRANDING)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [templateMutationPending, setTemplateMutationPending] = useState(false)

  const setPaperSize = useCallback((v: string) => setPaperSizeState(normalizePaperSize(v)), [])

  const setAllMargins = useCallback((v: number) => {
    setMarginTop(v)
    setMarginRight(v)
    setMarginBottom(v)
    setMarginLeft(v)
  }, [])

  const allTemplates = useMemo(
    () => [...templatesApi.customTemplates, ...systemVisualTemplates],
    [templatesApi.customTemplates, systemVisualTemplates],
  )

  const selectedTemplate = useMemo(
    () =>
      allTemplates.find((t) => t.id === selectedTemplateId) ??
      allTemplates[0] ??
      FALLBACK_VISUAL_TEMPLATE,
    [allTemplates, selectedTemplateId],
  )

  const sheetGrid = useMemo(
    () =>
      computeSheetGrid({
        paperSize,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        cellWidthMm,
        cellHeightMm,
        labelGapPx,
      }),
    [paperSize, marginTop, marginRight, marginBottom, marginLeft, cellWidthMm, cellHeightMm, labelGapPx],
  )

  const gridCols = previewMode === "sheet" ? sheetGrid.cols : 1
  const gridPreviewCount = previewCellCount({
    previewMode,
    selectedProductCount: selectedProducts.length,
    sheetCapacity: sheetGrid.capacity,
    quantity,
  })

  const cellsPerSheet = sheetGrid.capacity
  const estimatedPages = Math.max(
    1,
    Math.ceil(Math.max(selectedProducts.length * quantity, 1) / Math.max(cellsPerSheet, 1)),
  )

  const batchId = payload.recentBatches[0]?.id?.slice(0, 8) ?? null

  const showFaceToggle =
    (previewMode === "single" || previewMode === "hangtag") &&
    Boolean(selectedTemplate?.doubleSided)

  const printPreviewScanUrl = useMemo(() => {
    if (typeof window === "undefined") return null
    for (const p of selectedProducts) {
      if (p.passportId) return `${window.location.origin}/scan/${p.passportId}`
    }
    return null
  }, [selectedProducts])

  const primaryPassportProduct = useMemo(() => {
    for (const p of selectedProducts) {
      if (p.passportId) return p
    }
    return selectedProducts[0] ?? null
  }, [selectedProducts])

  const hydrationTarget = useMemo(
    () => ({
      setPreviewMode,
      setLayoutUnit,
      setMarginTop,
      setMarginRight,
      setMarginBottom,
      setMarginLeft,
      setMarginsLinked,
      setCellWidthMm,
      setCellHeightMm,
      setDimensionsLinked,
      setLabelGapPx,
      setQuantity,
      setPaperSize,
      setBleedMm,
      setDpi,
      setAlignment,
      setShowCropMarks,
      setSnapToGrid,
      setLabelFace,
      setBranding,
      setLogoDataUrl,
      aspectRatioRef,
      onExportFormatChange: setExportFormat,
    }),
    [setExportFormat],
  )

  const buildSnapshotSource = useCallback(async (): Promise<LayoutSnapshotSource> => {
    const preparedLogo = await prepareLogoForTemplateSnapshot(logoDataUrl)
    return {
      previewMode,
      layoutUnit,
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
      marginsLinked,
      cellWidthMm,
      cellHeightMm,
      dimensionsLinked,
      aspectRatio: aspectRatioRef.current,
      labelGapPx,
      quantity,
      paperSize,
      bleedMm,
      dpi,
      alignment,
      showCropMarks,
      snapToGrid,
      doubleSided: Boolean(selectedTemplate?.doubleSided),
      labelFace,
      cols: previewMode === "sheet" ? sheetGrid.cols : (selectedTemplate?.cols ?? 1),
      rows: previewMode === "sheet" ? sheetGrid.rows : (selectedTemplate?.rows ?? 1),
      exportFormat,
      branding: { ...branding },
      logoDataUrl: preparedLogo,
      baseSystemTemplateId: selectedTemplate?.isCustom
        ? selectedTemplate.layoutSnapshot?.baseSystemTemplateId ?? null
        : selectedTemplate?.id ?? null,
    }
  }, [
    previewMode,
    layoutUnit,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    marginsLinked,
    cellWidthMm,
    cellHeightMm,
    dimensionsLinked,
    labelGapPx,
    quantity,
    paperSize,
    bleedMm,
    dpi,
    alignment,
    showCropMarks,
    snapToGrid,
    selectedTemplate,
    labelFace,
    sheetGrid.cols,
    sheetGrid.rows,
    exportFormat,
    branding,
    logoDataUrl,
  ])

  const selectSystemFallback = useCallback(() => {
    const fallbackId = defaultFallbackTemplateId(systemVisualTemplates)
    setSelectedTemplateId(fallbackId)
  }, [systemVisualTemplates])

  const selectTemplate = useCallback(
    (id: string) => {
      const template = allTemplates.find((t) => t.id === id)
      if (!template) return
      setSelectedTemplateId(id)
      if (isPersistedCustom(template)) {
        applyLayoutSnapshot(hydrationTarget, template.layoutSnapshot)
      }
    },
    [allTemplates, hydrationTarget],
  )

  /** System presets only — custom templates hydrate from snapshot. */
  useEffect(() => {
    const t = selectedTemplate
    if (!t || t.isCustom) return
    if (t.doubleSided) {
      setPreviewMode("hangtag")
      setCellWidthMm(50)
      setCellHeightMm(90)
      aspectRatioRef.current = 50 / 90
      return
    }
    if (t.cols > 1 || t.rows > 1) {
      setPreviewMode("sheet")
      return
    }
    setPreviewMode("single")
    setLabelFace("front")
  }, [selectedTemplate])

  useEffect(() => {
    if (!showFaceToggle && labelFace === "back") setLabelFace("front")
  }, [showFaceToggle, labelFace])

  const saveTemplateBlockedReason = !canPersistTemplates
    ? "Sign in to save layout templates to your account."
    : null

  const openSaveTemplateDialog = useCallback(() => {
    if (saveTemplateBlockedReason) {
      toast.error(saveTemplateBlockedReason)
      return
    }
    setSaveDialogOpen(true)
  }, [saveTemplateBlockedReason, toast])

  const saveTemplateWithMeta = useCallback(
    async (name: string, description: string | null) => {
      if (saveTemplateBlockedReason) {
        toast.error(saveTemplateBlockedReason)
        return false
      }
      setTemplateMutationPending(true)
      const source = await buildSnapshotSource()
      const layout = buildLayoutSnapshot(source)
      const tempId = `optimistic-${Date.now()}`
      const optimistic: PersistedVisualTemplate = {
        id: tempId,
        persistedId: tempId,
        name: name.trim(),
        description,
        dimensions: layout.dimensions,
        cols: layout.cols,
        rows: layout.rows,
        doubleSided: layout.doubleSided,
        isCustom: true,
        layoutSnapshot: layout,
        updatedAt: new Date().toISOString(),
      }
      templatesApi.upsertLocal(optimistic)
      setSelectedTemplateId(tempId)
      try {
        const saved = await templatesApi.createTemplate({
          name: name.trim(),
          description,
          layout,
          dimensions: layout.dimensions,
          cols: layout.cols,
          rows: layout.rows,
          doubleSided: layout.doubleSided,
        })
        templatesApi.removeLocal(tempId)
        templatesApi.upsertLocal(saved)
        setSelectedTemplateId(saved.id)
        toast.success("Layout template saved.")
        setSaveDialogOpen(false)
        return true
      } catch (e) {
        templatesApi.removeLocal(tempId)
        selectSystemFallback()
        toast.error(e instanceof Error ? e.message : "Could not save template.")
        return false
      } finally {
        setTemplateMutationPending(false)
      }
    },
    [
      saveTemplateBlockedReason,
      buildSnapshotSource,
      templatesApi,
      toast,
      selectSystemFallback,
    ],
  )

  const duplicateCurrentTemplate = useCallback(async () => {
    if (saveTemplateBlockedReason) {
      toast.error(saveTemplateBlockedReason)
      return
    }
    if (!selectedTemplate) return
    setTemplateMutationPending(true)
    const source = await buildSnapshotSource()
    const layout = buildLayoutSnapshot(source)
    const duplicateName = uniquifyTemplateName(
      selectedTemplate.name,
      templatesApi.templateNames,
    )
    const tempId = `optimistic-${Date.now()}`
    const optimistic: PersistedVisualTemplate = {
      id: tempId,
      persistedId: tempId,
      name: duplicateName,
      description: isPersistedCustom(selectedTemplate) ? selectedTemplate.description : null,
      dimensions: layout.dimensions,
      cols: layout.cols,
      rows: layout.rows,
      doubleSided: layout.doubleSided,
      isCustom: true,
      layoutSnapshot: layout,
      updatedAt: new Date().toISOString(),
    }
    templatesApi.upsertLocal(optimistic)
    setSelectedTemplateId(tempId)
    try {
      const saved = await templatesApi.createTemplate({
        name: duplicateName,
        description: isPersistedCustom(selectedTemplate) ? selectedTemplate.description : null,
        layout,
        dimensions: layout.dimensions,
        cols: layout.cols,
        rows: layout.rows,
        doubleSided: layout.doubleSided,
      })
      templatesApi.removeLocal(tempId)
      templatesApi.upsertLocal(saved)
      setSelectedTemplateId(saved.id)
      toast.success("Template duplicated.")
    } catch (e) {
      templatesApi.removeLocal(tempId)
      selectSystemFallback()
      toast.error(e instanceof Error ? e.message : "Could not duplicate template.")
    } finally {
      setTemplateMutationPending(false)
    }
  }, [
    saveTemplateBlockedReason,
    selectedTemplate,
    buildSnapshotSource,
    templatesApi,
    toast,
    selectSystemFallback,
  ])

  const updateTemplateLayoutById = useCallback(
    async (id: string) => {
      if (saveTemplateBlockedReason) {
        toast.error(saveTemplateBlockedReason)
        return
      }
      setTemplateMutationPending(true)
      const source = await buildSnapshotSource()
      const layout = buildLayoutSnapshot(source)
      try {
        const saved = await templatesApi.patchTemplate(id, {
          layout,
          dimensions: layout.dimensions,
          cols: layout.cols,
          rows: layout.rows,
          doubleSided: layout.doubleSided,
        })
        templatesApi.upsertLocal(saved)
        if (selectedTemplateId === id) {
          setSelectedTemplateId(saved.id)
          applyLayoutSnapshot(hydrationTarget, saved.layoutSnapshot)
        }
        toast.success("Template updated with current layout.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update template.")
      } finally {
        setTemplateMutationPending(false)
      }
    },
    [
      saveTemplateBlockedReason,
      buildSnapshotSource,
      templatesApi,
      selectedTemplateId,
      hydrationTarget,
      toast,
    ],
  )

  const updateSelectedTemplateLayout = useCallback(async () => {
    if (!isPersistedCustom(selectedTemplate)) return
    await updateTemplateLayoutById(selectedTemplate.id)
  }, [selectedTemplate, updateTemplateLayoutById])

  const renameTemplate = useCallback(
    async (id: string, name: string, description: string | null) => {
      if (saveTemplateBlockedReason) {
        toast.error(saveTemplateBlockedReason)
        return false
      }
      setTemplateMutationPending(true)
      try {
        const saved = await templatesApi.patchTemplate(id, { name: name.trim(), description })
        templatesApi.upsertLocal(saved)
        if (selectedTemplateId === id) setSelectedTemplateId(saved.id)
        toast.success("Template renamed.")
        return true
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not rename template.")
        return false
      } finally {
        setTemplateMutationPending(false)
      }
    },
    [saveTemplateBlockedReason, templatesApi, selectedTemplateId, toast],
  )

  const deleteTemplate = useCallback(
    async (id: string) => {
      if (saveTemplateBlockedReason) {
        toast.error(saveTemplateBlockedReason)
        return false
      }
      const wasSelected = selectedTemplateId === id
      setTemplateMutationPending(true)
      try {
        await templatesApi.removeTemplate(id)
        if (wasSelected) selectSystemFallback()
        toast.success("Template deleted.")
        return true
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete template.")
        return false
      } finally {
        setTemplateMutationPending(false)
      }
    },
    [saveTemplateBlockedReason, templatesApi, selectedTemplateId, selectSystemFallback, toast],
  )

  const patchBranding = useCallback(
    (patch: Partial<LabelPreviewBranding>) => setBranding((b) => ({ ...b, ...patch })),
    [],
  )

  const setQrStyle = useCallback((id: QrStyleId) => patchBranding({ qrStyle: id }), [patchBranding])
  const setBrandColor = useCallback((v: string) => patchBranding({ brandColor: v }), [patchBranding])
  const setBorderStyle = useCallback(
    (v: LabelPreviewBranding["borderStyle"]) => patchBranding({ borderStyle: v }),
    [patchBranding],
  )
  const setTypographyStyle = useCallback(
    (v: LabelPreviewBranding["typographyStyle"]) => patchBranding({ typographyStyle: v }),
    [patchBranding],
  )
  const setFooterText = useCallback((v: string) => patchBranding({ footerText: v }), [patchBranding])
  const setQrSizeInches = useCallback((v: number) => patchBranding({ qrSizeInches: v }), [patchBranding])
  const setLabelTextPt = useCallback((v: number) => patchBranding({ labelTextPt: v }), [patchBranding])
  const setShowQrCode: Dispatch<SetStateAction<boolean>> = useCallback(
    (v) =>
      setBranding((b) => ({
        ...b,
        showQrCode: typeof v === "function" ? v(b.showQrCode) : v,
      })),
    [],
  )
  const setShowProductName: Dispatch<SetStateAction<boolean>> = useCallback(
    (v) =>
      setBranding((b) => ({
        ...b,
        showProductName: typeof v === "function" ? v(b.showProductName) : v,
      })),
    [],
  )
  const setShowLogo: Dispatch<SetStateAction<boolean>> = useCallback(
    (v) =>
      setBranding((b) => ({
        ...b,
        showLogo: typeof v === "function" ? v(b.showLogo) : v,
      })),
    [],
  )

  const zoomOut = useCallback(() => {
    setPreviewZoom((z) => {
      const i = ZOOM_STEPS.indexOf(z)
      return ZOOM_STEPS[Math.max(0, i <= 0 ? 0 : i - 1)] ?? 50
    })
  }, [])

  const zoomIn = useCallback(() => {
    setPreviewZoom((z) => {
      const i = ZOOM_STEPS.indexOf(z)
      return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, i < 0 ? 2 : i + 1)] ?? 100
    })
  }, [])

  const saveDialogDefaultName = useMemo(
    () => suggestSaveTemplateName(selectedTemplate?.name),
    [selectedTemplate?.name],
  )

  return {
    studioFieldId,
    quantityInputId,
    footerTextInputId,
    aspectRatioRef,
    visualTemplates: allTemplates,
    systemVisualTemplates,
    customTemplates: templatesApi.customTemplates,
    customTemplatesLoading: templatesApi.loading,
    customTemplatesError: templatesApi.error,
    templateModalOpen,
    setTemplateModalOpen,
    saveDialogOpen,
    setSaveDialogOpen,
    saveDialogDefaultName,
    saveTemplateBlockedReason,
    templateMutationPending,
    selectedTemplateId,
    setSelectedTemplateId: selectTemplate,
    selectedTemplate,
    duplicateCurrentTemplate,
    openSaveTemplateDialog,
    saveTemplateWithMeta,
    updateSelectedTemplateLayout,
    updateTemplateLayoutById,
    renameTemplate,
    deleteTemplate,
    previewMode,
    setPreviewMode,
    previewZoom,
    setPreviewZoom,
    zoomOut,
    zoomIn,
    labelFace,
    setLabelFace,
    showFaceToggle,
    layoutUnit,
    setLayoutUnit,
    marginTop,
    setMarginTop,
    marginRight,
    setMarginRight,
    marginBottom,
    setMarginBottom,
    marginLeft,
    setMarginLeft,
    marginsLinked,
    setMarginsLinked,
    setAllMargins,
    cellWidthMm,
    setCellWidthMm,
    cellHeightMm,
    setCellHeightMm,
    dimensionsLinked,
    setDimensionsLinked,
    labelGapPx,
    setLabelGapPx,
    paperSize,
    setPaperSize,
    quantity,
    setQuantity,
    bleedMm,
    setBleedMm,
    dpi,
    setDpi,
    alignment,
    setAlignment,
    showCropMarks,
    setShowCropMarks,
    snapToGrid,
    setSnapToGrid,
    branding,
    setBranding,
    qrStyle: branding.qrStyle,
    setQrStyle,
    brandColor: branding.brandColor,
    setBrandColor,
    borderStyle: branding.borderStyle,
    setBorderStyle,
    typographyStyle: branding.typographyStyle,
    setTypographyStyle,
    footerText: branding.footerText,
    setFooterText,
    showQrCode: branding.showQrCode,
    setShowQrCode,
    showProductName: branding.showProductName,
    setShowProductName,
    showLogo: branding.showLogo,
    setShowLogo,
    qrSizeInches: branding.qrSizeInches,
    setQrSizeInches,
    labelTextPt: branding.labelTextPt,
    setLabelTextPt,
    logoDataUrl,
    setLogoDataUrl,
    sheetGrid,
    gridCols,
    gridPreviewCount,
    cellsPerSheet,
    estimatedPages,
    batchId,
    printPreviewScanUrl,
    primaryPassportProduct,
  }
}
