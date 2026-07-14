import type { LabelPreviewBranding } from "@/components/dashboard/qr-identity/print-labels/LabelPreviewCell"
import type { LayoutUnit, PreviewMode } from "@/components/dashboard/qr-identity/print-labels/types"
import { formatLengthFromMm } from "@/components/dashboard/qr-identity/print-labels/layout-utils"
import {
  LABEL_LAYOUT_SNAPSHOT_VERSION,
  type LabelLayoutSnapshot,
  type LabelLayoutTemplateRow,
  type PersistedVisualTemplate,
} from "@/lib/labels/layout-template-types"
import { FALLBACK_VISUAL_TEMPLATE } from "@/components/dashboard/qr-identity/print-labels/visual-templates"

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

export type LayoutSnapshotSource = {
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
  exportFormat: string
  branding: LabelPreviewBranding
  logoDataUrl: string | null
  baseSystemTemplateId?: string | null
}

export function formatDimensionsLabel(cellWidthMm: number, cellHeightMm: number): string {
  return `${formatLengthFromMm(cellWidthMm, "mm")} × ${formatLengthFromMm(cellHeightMm, "mm")}`
}

export function buildLayoutSnapshot(source: LayoutSnapshotSource): LabelLayoutSnapshot {
  return {
    snapshotVersion: LABEL_LAYOUT_SNAPSHOT_VERSION,
    previewMode: source.previewMode,
    layoutUnit: source.layoutUnit,
    marginTop: source.marginTop,
    marginRight: source.marginRight,
    marginBottom: source.marginBottom,
    marginLeft: source.marginLeft,
    marginsLinked: source.marginsLinked,
    cellWidthMm: source.cellWidthMm,
    cellHeightMm: source.cellHeightMm,
    dimensionsLinked: source.dimensionsLinked,
    aspectRatio: source.aspectRatio,
    labelGapPx: source.labelGapPx,
    quantity: source.quantity,
    paperSize: source.paperSize,
    bleedMm: source.bleedMm,
    dpi: source.dpi,
    alignment: source.alignment,
    showCropMarks: source.showCropMarks,
    snapToGrid: source.snapToGrid,
    doubleSided: source.doubleSided,
    labelFace: source.labelFace,
    cols: source.cols,
    rows: source.rows,
    dimensions: formatDimensionsLabel(source.cellWidthMm, source.cellHeightMm),
    exportFormat: source.exportFormat,
    branding: { ...source.branding },
    logoDataUrl: source.logoDataUrl,
    baseSystemTemplateId: source.baseSystemTemplateId ?? null,
  }
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function normalizePreviewMode(value: unknown): PreviewMode {
  if (value === "single" || value === "sheet" || value === "hangtag" || value === "packaging") {
    return value
  }
  return "single"
}

function normalizeLayoutUnit(value: unknown): LayoutUnit {
  if (value === "mm" || value === "in" || value === "px") return value
  return "mm"
}

function normalizeBranding(raw: unknown): LabelPreviewBranding {
  const b = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const border = b.borderStyle
  const typography = b.typographyStyle
  return {
    qrStyle:
      b.qrStyle === "dot" ||
      b.qrStyle === "shield" ||
      b.qrStyle === "minimal" ||
      b.qrStyle === "luxury" ||
      b.qrStyle === "classic"
        ? b.qrStyle
        : DEFAULT_BRANDING.qrStyle,
    brandColor: asString(b.brandColor, DEFAULT_BRANDING.brandColor),
    borderStyle:
      border === "none" || border === "thin" || border === "premium"
        ? border
        : DEFAULT_BRANDING.borderStyle,
    typographyStyle:
      typography === "serif" || typography === "sans" || typography === "luxury"
        ? typography
        : DEFAULT_BRANDING.typographyStyle,
    footerText: asString(b.footerText, DEFAULT_BRANDING.footerText),
    showLogo: asBoolean(b.showLogo, DEFAULT_BRANDING.showLogo),
    showQrCode: asBoolean(b.showQrCode, DEFAULT_BRANDING.showQrCode),
    showProductName: asBoolean(b.showProductName, DEFAULT_BRANDING.showProductName),
    qrSizeInches: asNumber(b.qrSizeInches, DEFAULT_BRANDING.qrSizeInches),
    labelTextPt: asNumber(b.labelTextPt, DEFAULT_BRANDING.labelTextPt),
  }
}

/** Tolerates missing keys from older snapshots. */
export function normalizeLayoutSnapshot(raw: unknown): LabelLayoutSnapshot {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const cellWidthMm = asNumber(o.cellWidthMm, 50)
  const cellHeightMm = asNumber(o.cellHeightMm, 90)
  const branding = normalizeBranding(o.branding)
  const logoFromRoot =
    typeof o.logoDataUrl === "string" || o.logoDataUrl === null ? o.logoDataUrl : null

  return {
    snapshotVersion: asNumber(o.snapshotVersion, 1),
    previewMode: normalizePreviewMode(o.previewMode),
    layoutUnit: normalizeLayoutUnit(o.layoutUnit),
    marginTop: asNumber(o.marginTop, 10),
    marginRight: asNumber(o.marginRight, 10),
    marginBottom: asNumber(o.marginBottom, 10),
    marginLeft: asNumber(o.marginLeft, 10),
    marginsLinked: asBoolean(o.marginsLinked, true),
    cellWidthMm,
    cellHeightMm,
    dimensionsLinked: asBoolean(o.dimensionsLinked, true),
    aspectRatio: asNumber(o.aspectRatio, cellWidthMm / Math.max(cellHeightMm, 1)),
    labelGapPx: asNumber(o.labelGapPx, 8),
    quantity: Math.max(1, asNumber(o.quantity, 1)),
    paperSize: asString(o.paperSize, "a4"),
    bleedMm: asNumber(o.bleedMm, 2),
    dpi: asNumber(o.dpi, 300),
    alignment: asString(o.alignment, "center"),
    showCropMarks: asBoolean(o.showCropMarks, false),
    snapToGrid: asBoolean(o.snapToGrid, true),
    doubleSided: asBoolean(o.doubleSided, false),
    labelFace: o.labelFace === "back" ? "back" : "front",
    cols: Math.max(1, asNumber(o.cols, 1)),
    rows: Math.max(1, asNumber(o.rows, 1)),
    dimensions: asString(o.dimensions, formatDimensionsLabel(cellWidthMm, cellHeightMm)),
    exportFormat: asString(o.exportFormat, "pdf"),
    branding,
    logoDataUrl: logoFromRoot,
    baseSystemTemplateId:
      typeof o.baseSystemTemplateId === "string" ? o.baseSystemTemplateId : null,
  }
}

export type LayoutHydrationTarget = {
  setPreviewMode: (m: PreviewMode) => void
  setLayoutUnit: (u: LayoutUnit) => void
  setMarginTop: (v: number) => void
  setMarginRight: (v: number) => void
  setMarginBottom: (v: number) => void
  setMarginLeft: (v: number) => void
  setMarginsLinked: (v: boolean) => void
  setCellWidthMm: (v: number) => void
  setCellHeightMm: (v: number) => void
  setDimensionsLinked: (v: boolean) => void
  setLabelGapPx: (v: number) => void
  setQuantity: (v: number) => void
  setPaperSize: (v: string) => void
  setBleedMm: (v: number) => void
  setDpi: (v: number) => void
  setAlignment: (v: string) => void
  setShowCropMarks: (v: boolean) => void
  setSnapToGrid: (v: boolean) => void
  setLabelFace: (v: "front" | "back") => void
  setBranding: (b: LabelPreviewBranding) => void
  setLogoDataUrl: (v: string | null) => void
  aspectRatioRef: { current: number }
  onExportFormatChange?: (v: string) => void
}

export function applyLayoutSnapshot(target: LayoutHydrationTarget, raw: unknown): LabelLayoutSnapshot {
  const snap = normalizeLayoutSnapshot(raw)

  target.setPreviewMode(snap.previewMode)
  target.setLayoutUnit(snap.layoutUnit)
  target.setMarginTop(snap.marginTop)
  target.setMarginRight(snap.marginRight)
  target.setMarginBottom(snap.marginBottom)
  target.setMarginLeft(snap.marginLeft)
  target.setMarginsLinked(snap.marginsLinked)
  target.setCellWidthMm(snap.cellWidthMm)
  target.setCellHeightMm(snap.cellHeightMm)
  target.setDimensionsLinked(snap.dimensionsLinked)
  target.aspectRatioRef.current = snap.aspectRatio
  target.setLabelGapPx(snap.labelGapPx)
  target.setQuantity(snap.quantity)
  target.setPaperSize(snap.paperSize)
  target.setBleedMm(snap.bleedMm)
  target.setDpi(snap.dpi)
  target.setAlignment(snap.alignment)
  target.setShowCropMarks(snap.showCropMarks)
  target.setSnapToGrid(snap.snapToGrid)
  target.setLabelFace(snap.labelFace)
  target.setBranding(snap.branding)
  target.setLogoDataUrl(snap.logoDataUrl)
  target.onExportFormatChange?.(snap.exportFormat)

  return snap
}

export function rowToPersistedVisualTemplate(row: LabelLayoutTemplateRow): PersistedVisualTemplate {
  const layout = normalizeLayoutSnapshot(row.layout)
  return {
    id: row.id,
    persistedId: row.id,
    name: row.name,
    description: row.description,
    dimensions: row.dimensions || layout.dimensions,
    cols: row.cols,
    rows: row.rows,
    doubleSided: row.double_sided,
    isCustom: true,
    layoutSnapshot: layout,
    updatedAt: row.updated_at,
  }
}

export function defaultFallbackTemplateId(systemTemplates: { id: string }[]): string {
  return systemTemplates[0]?.id ?? FALLBACK_VISUAL_TEMPLATE.id
}

/** Generate a unique duplicate name against existing names (case-insensitive). */
export function uniquifyTemplateName(baseName: string, existingNames: string[]): string {
  const normalized = new Set(existingNames.map((n) => n.trim().toLowerCase()))
  const root = baseName.trim() || "Untitled template"
  const candidate = `${root} (copy)`
  if (!normalized.has(candidate.toLowerCase())) return candidate
  let i = 2
  while (normalized.has(`${root} (copy ${i})`.toLowerCase())) i += 1
  return `${root} (copy ${i})`
}

export function suggestSaveTemplateName(currentName: string | undefined): string {
  const base = currentName?.trim() || "Custom layout"
  if (/(\(custom\)|\(copy\))/i.test(base)) return base
  return `${base} (custom)`
}
