import type { ProductPrintCandidate, PrintJobRow } from "@/lib/label-print-studio-server-data"
import type { LabelLayoutSnapshot } from "@/lib/labels/layout-template-types"

export type LayoutUnit = "mm" | "in" | "px"
export type QrStyleId = "classic" | "dot" | "shield" | "minimal" | "luxury"
export type PreviewMode = "single" | "sheet" | "hangtag" | "packaging"

export type VisualTemplate = {
  id: string
  name: string
  dimensions: string
  cols: number
  rows: number
  /** Hang tags and similar templates support a printable back face. */
  doubleSided?: boolean
  isCustom?: boolean
  /** Present on persisted custom templates from the API. */
  persistedId?: string
  description?: string | null
  layoutSnapshot?: LabelLayoutSnapshot
  updatedAt?: string
}

export type StudioLayoutState = {
  layoutUnit: LayoutUnit
  cellWidthMm: number
  cellHeightMm: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  labelGapPx: number
  bleedMm: number
  dpi: number
  paperSize: string
  quantity: number
  alignment: string
  exportFormat: string
  snapToGrid: boolean
  showCropMarks: boolean
  previewMode: PreviewMode
  previewZoom: 50 | 75 | 100
}

export type StudioBrandingState = {
  qrStyle: QrStyleId
  brandColor: string
  borderStyle: "none" | "thin" | "premium"
  typographyStyle: "serif" | "sans" | "luxury"
  footerText: string
  logoDataUrl: string | null
  showLogo: boolean
  showQrCode: boolean
  showProductName: boolean
  qrSizeInches: number
  labelTextPt: number
}

export type LabelQueueRequest = {
  action: "export" | "print"
  format: string
  templateId: string | null
  templateName: string
  productIds: string[]
  labelCount: number
  layoutMode: PreviewMode
  printerType?: string
}

export type PrintHistoryEntry = PrintJobRow

export type { ProductPrintCandidate }
