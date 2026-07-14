import type { LabelPreviewBranding } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewCell"
import type { LayoutUnit, PreviewMode, VisualTemplate } from "@/components/dashboard/qr-identity/print-labels/types"

export const LABEL_LAYOUT_SNAPSHOT_VERSION = 1

export const LABEL_TEMPLATE_NAME_MAX = 120
export const LABEL_TEMPLATE_DESCRIPTION_MAX = 500
export const LABEL_TEMPLATE_LOGO_MAX_BYTES = 100_000

/** Full layout state serialized to JSONB — single source of truth for restore. */
export type LabelLayoutSnapshot = {
  snapshotVersion: number
  previewMode: PreviewMode
  layoutUnit: LayoutUnit
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  marginsLinked: boolean
  cellWidthMm: number
  cellHeightMm: number
  dimensionsLinked: boolean
  aspectRatio: number
  labelGapPx: number
  quantity: number
  paperSize: string
  bleedMm: number
  dpi: number
  alignment: string
  showCropMarks: boolean
  snapToGrid: boolean
  doubleSided: boolean
  labelFace: "front" | "back"
  cols: number
  rows: number
  dimensions: string
  exportFormat: string
  branding: LabelPreviewBranding
  logoDataUrl: string | null
  baseSystemTemplateId?: string | null
}

export type LabelLayoutTemplateRow = {
  id: string
  brand_id: string
  created_by: string
  name: string
  description: string | null
  layout: LabelLayoutSnapshot
  dimensions: string
  cols: number
  rows: number
  double_sided: boolean
  created_at: string
  updated_at: string
}

/** Custom template row mapped for Label Studio UI (extends VisualTemplate). */
export type PersistedVisualTemplate = VisualTemplate & {
  isCustom: true
  persistedId: string
  description: string | null
  layoutSnapshot: LabelLayoutSnapshot
  updatedAt: string
}

export type CreateLayoutTemplateInput = {
  name: string
  description?: string | null
  layout: LabelLayoutSnapshot
  dimensions: string
  cols: number
  rows: number
  doubleSided: boolean
}

export type UpdateLayoutTemplateInput = {
  name?: string
  description?: string | null
  layout?: LabelLayoutSnapshot
  dimensions?: string
  cols?: number
  rows?: number
  doubleSided?: boolean
}
