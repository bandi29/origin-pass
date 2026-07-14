import { describe, expect, it } from "vitest"
import { getTablePaginationMeta } from "@/components/ui/TablePagination"

describe("TablePagination", () => {
  it("computes page ranges for partial final pages", () => {
    expect(getTablePaginationMeta(0, 10, 7)).toEqual({
      totalPages: 1,
      currentPage: 0,
      rangeStart: 1,
      rangeEnd: 7,
    })
    expect(getTablePaginationMeta(1, 10, 25)).toEqual({
      totalPages: 3,
      currentPage: 1,
      rangeStart: 11,
      rangeEnd: 20,
    })
  })

  it("clamps page index when total pages shrink", () => {
    expect(getTablePaginationMeta(4, 10, 12).currentPage).toBe(1)
  })
})
