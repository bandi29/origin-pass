import { describe, expect, it } from "vitest"
import { computeSheetGrid, previewCellCount } from "@/components/dashboard/qr-identity/print-labels/sheet-layout-math"

describe("computeSheetGrid", () => {
  it("fits cells from page size, margins, cell size, and gutter", () => {
    const grid = computeSheetGrid({
      paperSize: "a4",
      marginTop: 10,
      marginRight: 10,
      marginBottom: 10,
      marginLeft: 10,
      cellWidthMm: 50,
      cellHeightMm: 50,
      labelGapPx: 8,
    })
    expect(grid.cols).toBeGreaterThanOrEqual(3)
    expect(grid.rows).toBeGreaterThanOrEqual(4)
    expect(grid.capacity).toBe(grid.cols * grid.rows)
  })
})

describe("previewCellCount", () => {
  it("returns 0 when nothing is selected", () => {
    expect(
      previewCellCount({
        previewMode: "sheet",
        selectedProductCount: 0,
        sheetCapacity: 12,
        quantity: 1,
      }),
    ).toBe(0)
  })

  it("returns one cell in single mode", () => {
    expect(
      previewCellCount({
        previewMode: "single",
        selectedProductCount: 2,
        sheetCapacity: 12,
        quantity: 3,
      }),
    ).toBe(1)
  })
})
