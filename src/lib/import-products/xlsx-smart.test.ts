import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { detectHeaderRowIndex, rowLooksLikeHeader, sheetToStringRecordRows } from "./xlsx-smart"

describe("xlsx-smart", () => {
  it("rowLooksLikeHeader requires two+ labels and rejects mostly-numeric rows", () => {
    expect(rowLooksLikeHeader(["Title"])).toBe(false)
    expect(rowLooksLikeHeader(["Name", "SKU"])).toBe(true)
    expect(rowLooksLikeHeader(["1", "2", "3"])).toBe(false)
  })

  it("detectHeaderRowIndex skips a single-cell title row", () => {
    const aoa = [
      ["Product Catalogue"],
      ["Name", "SKU", "Price"],
      ["Widget", "W1", "9.99"],
    ]
    expect(detectHeaderRowIndex(aoa)).toBe(1)
  })

  it("sheetToStringRecordRows uses detected headers and data rows", () => {
    const aoa = [
      ["Catalog", "", ""],
      ["Product name", "SKU", "Category"],
      ["A", "s1", "Cat"],
      ["B", "s2", "Cat"],
    ]
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    const { headers, rows, headerRowIndex } = sheetToStringRecordRows(sheet)
    expect(headerRowIndex).toBe(1)
    expect(headers).toEqual(["Product name", "SKU", "Category"])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ SKU: "s1", Category: "Cat" })
  })
})
