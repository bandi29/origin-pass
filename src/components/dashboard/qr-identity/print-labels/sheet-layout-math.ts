import type { PreviewMode } from "@/components/dashboard/qr-identity/print-labels/types"

export const PAPER_SIZES_MM: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
}

/** Screen gutter (px) → mm at 96 CSS dpi. */
export function labelGapPxToMm(px: number): number {
  return px * (25.4 / 96)
}

export function computeSheetGrid(params: {
  paperSize: string
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  cellWidthMm: number
  cellHeightMm: number
  labelGapPx: number
}): { cols: number; rows: number; capacity: number } {
  const paper = PAPER_SIZES_MM[params.paperSize.toLowerCase()] ?? PAPER_SIZES_MM.a4
  const gapMm = labelGapPxToMm(params.labelGapPx)
  const usableW = Math.max(0, paper.width - params.marginLeft - params.marginRight)
  const usableH = Math.max(0, paper.height - params.marginTop - params.marginBottom)
  const cols = Math.max(
    1,
    Math.floor((usableW + gapMm) / (params.cellWidthMm + gapMm)),
  )
  const rows = Math.max(
    1,
    Math.floor((usableH + gapMm) / (params.cellHeightMm + gapMm)),
  )
  return { cols, rows, capacity: cols * rows }
}

/** How many cells to paint in the sheet preview. */
export function sheetPreviewCellCount(params: {
  capacity: number
  selectedProductCount: number
  quantity: number
}): number {
  const { capacity, selectedProductCount, quantity } = params
  if (capacity <= 0) return 0
  const labelsNeeded = Math.max(selectedProductCount, 1) * Math.max(quantity, 1)
  return Math.min(capacity, labelsNeeded)
}

export function previewCellCount(params: {
  previewMode: PreviewMode
  selectedProductCount: number
  sheetCapacity: number
  quantity: number
}): number {
  if (params.selectedProductCount === 0) return 0
  if (params.previewMode === "single" || params.previewMode === "hangtag" || params.previewMode === "packaging") {
    return 1
  }
  return sheetPreviewCellCount({
    capacity: params.sheetCapacity,
    selectedProductCount: params.selectedProductCount,
    quantity: params.quantity,
  })
}
