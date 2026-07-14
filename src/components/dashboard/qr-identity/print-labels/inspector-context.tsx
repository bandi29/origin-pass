"use client"

import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react"
import type {
  LayoutUnit,
  PreviewMode,
  QrStyleId,
  VisualTemplate,
} from "@/components/dashboard/qr-identity/print-labels/types"
import type { LabelStudioWorkflowStatus } from "@/components/dashboard/qr-identity/label-studio/label-studio-workflow-status"
import type { ProductPrintCandidate, PrintJobRow } from "@/lib/label-print-studio-server-data"

/**
 * Everything the four Inspector tab bodies need, threaded once through a context
 * instead of ~40 individual props. The values are owned by PrintLabelsStudioClient
 * — this is purely a transport so the tab files stay small and state stays in one
 * place. No control's binding or side effect changes.
 */
export type InspectorContextValue = {
  // ── ids ───────────────────────────────────────────────────────────────
  studioFieldId: string
  quantityInputId: string
  footerTextInputId: string

  // ── measurement ───────────────────────────────────────────────────────
  layoutUnit: LayoutUnit
  setLayoutUnit: (u: LayoutUnit) => void

  // ── layout: structure + template ──────────────────────────────────────
  previewMode: PreviewMode
  setPreviewMode: (m: PreviewMode) => void
  selectedTemplate: VisualTemplate | null
  setTemplateModalOpen: (open: boolean) => void
  duplicateCurrentTemplate: () => void | Promise<void>
  openSaveTemplateDialog: () => void
  saveTemplateBlockedReason: string | null
  templateMutationPending: boolean

  // ── layout: margins ───────────────────────────────────────────────────
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  setMarginTop: (v: number) => void
  setMarginRight: (v: number) => void
  setMarginBottom: (v: number) => void
  setMarginLeft: (v: number) => void
  marginsLinked: boolean
  setMarginsLinked: (v: boolean) => void
  /** Sets every side at once (used when "link all sides" is on). */
  setAllMargins: (v: number) => void

  // ── layout: cell size ─────────────────────────────────────────────────
  cellWidthMm: number
  setCellWidthMm: (v: number) => void
  cellHeightMm: number
  setCellHeightMm: (v: number) => void
  dimensionsLinked: boolean
  setDimensionsLinked: Dispatch<SetStateAction<boolean>>
  aspectRatioRef: RefObject<number>
  labelGapPx: number
  setLabelGapPx: (v: number) => void
  quantity: number
  setQuantity: (v: number) => void

  // ── branding ──────────────────────────────────────────────────────────
  qrStyle: QrStyleId
  setQrStyle: (id: QrStyleId) => void
  showQrCode: boolean
  setShowQrCode: Dispatch<SetStateAction<boolean>>
  showProductName: boolean
  setShowProductName: Dispatch<SetStateAction<boolean>>
  showLogo: boolean
  setShowLogo: Dispatch<SetStateAction<boolean>>
  qrSizeInches: number
  setQrSizeInches: (v: number) => void
  labelTextPt: number
  setLabelTextPt: (v: number) => void
  brandColor: string
  setBrandColor: (v: string) => void
  borderStyle: "none" | "thin" | "premium"
  setBorderStyle: (v: "none" | "thin" | "premium") => void
  typographyStyle: "serif" | "sans" | "luxury"
  setTypographyStyle: (v: "serif" | "sans" | "luxury") => void
  footerText: string
  setFooterText: (v: string) => void
  logoDataUrl: string | null
  setLogoDataUrl: (v: string | null) => void

  // ── destination ───────────────────────────────────────────────────────
  printPreviewScanUrl: string | null
  primaryPassportProduct: ProductPrintCandidate | null
  copyScanLink: () => void
  openScanPreview: () => void

  // ── output ────────────────────────────────────────────────────────────
  bleedMm: number
  setBleedMm: (v: number) => void
  dpi: number
  setDpi: (v: number) => void
  paperSize: string
  setPaperSize: (v: string) => void
  alignment: string
  setAlignment: (v: string) => void
  showCropMarks: boolean
  setShowCropMarks: Dispatch<SetStateAction<boolean>>
  snapToGrid: boolean
  setSnapToGrid: Dispatch<SetStateAction<boolean>>
  exportFormat: string
  setExportFormat: (v: string) => void
  handleExportSelected: (format: string) => void
  exportSubmitting: boolean
  printHistory: PrintJobRow[]

  // ── derived (dock + status dots + export gating) ─────────────────────────
  workflow: LabelStudioWorkflowStatus
  selectedProducts: ProductPrintCandidate[]
  selectedProductIds: string[]
  cellsPerSheet: number
  estimatedPages: number
  /** Most recent batch id (short) for the dock summary; null when none. */
  batchId: string | null
  /** Renders a single label cell at index i — reused for the dock thumbnail. */
  renderLabelCell: (i: number) => ReactNode
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function InspectorProvider({
  value,
  children,
}: {
  value: InspectorContextValue
  children: ReactNode
}) {
  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>
}

export function useInspector(): InspectorContextValue {
  const ctx = useContext(InspectorContext)
  if (!ctx) {
    throw new Error("useInspector must be used within an InspectorProvider")
  }
  return ctx
}

/** Status of a tab's section — drives the tab-bar dot. */
export type InspectorTabStatus = "valid" | "attention" | "info"
