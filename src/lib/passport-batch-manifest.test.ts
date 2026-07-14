import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, beforeAll } from "vitest"
import * as XLSX from "xlsx"
import {
  detectCsvDelimiter,
  normalizeHeader,
  normalizeRowObjects,
  parsePassportManifestCsv,
  parsePassportManifestFile,
  parsePassportManifestXlsx,
  validateManifestHeaders,
} from "./passport-batch-manifest"

const FIXTURE_DIR = path.join(process.cwd(), "public/test-fixtures/batch-import")
const FIXTURE_CSV = path.join(FIXTURE_DIR, "queue-batch-job-test-data.csv")
const FIXTURE_XLSX = path.join(FIXTURE_DIR, "queue-batch-job-test-data.xlsx")

beforeAll(() => {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  const csvText = readFileSync(FIXTURE_CSV, "utf8")
  const rows = csvText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","))
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Queue Batch Job test data")
  writeFileSync(FIXTURE_XLSX, XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }))
})

describe("passport-batch-manifest", () => {
  it("normalizes header variants before validation", () => {
    expect(normalizeHeader("Product_Name ")).toBe("product_name")
    expect(normalizeHeader("SKU")).toBe("sku")
    expect(normalizeHeader("Origin Geo")).toBe("origin_geo")
  })

  it("validates required headers after normalization", () => {
    const err = validateManifestHeaders(["Product_Name", "SKU", "Batch_ID", "origin_geo", "Description"])
    expect(err).toBeNull()
  })

  it("returns strict missing-column error for the first absent header", () => {
    const err = validateManifestHeaders(["product_name", "sku", "origin_geo", "description"])
    expect(err).toBe(
      'Missing required column "batch_id". Expected: product_name, sku, batch_id, origin_geo, description',
    )
  })

  it("detects semicolon delimiters from Excel CSV exports", () => {
    const csv = [
      "product_name;sku;batch_id;origin_geo;description",
      "Leather Bag;SKU-1;BATCH-1;Florence;Handmade tote",
    ].join("\n")
    expect(detectCsvDelimiter(csv)).toBe(";")
    const result = parsePassportManifestCsv(csv)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rows[0]?.sku).toBe("SKU-1")
  })

  it("parses csv with a title row before headers", () => {
    const csv = [
      "Queue Batch Job test data,,,,",
      "product_name,sku,batch_id,origin_geo,description",
      "Leather Bag,SKU-1,BATCH-1,Florence,Handmade tote",
    ].join("\n")
    const result = parsePassportManifestCsv(csv)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rows[0]?.product_name).toBe("Leather Bag")
  })

  it("parses fixture Queue Batch Job test data.csv", async () => {
    const csvText = readFileSync(FIXTURE_CSV, "utf8")
    const csvResult = parsePassportManifestCsv(csvText)
    expect(csvResult.ok).toBe(true)
    if (csvResult.ok) {
      expect(csvResult.rows.length).toBeGreaterThanOrEqual(3)
      expect(csvResult.rows[0]?.product_name).toBe("Artisan Leather Tote")
    }

    const csvFile = new File([csvText], "Queue Batch Job test data.csv", { type: "text/csv" })
    const fileResult = await parsePassportManifestFile(csvFile)
    expect(fileResult.ok).toBe(true)
    if (fileResult.ok) expect(fileResult.uniqueCount).toBeGreaterThanOrEqual(3)
  })

  it("parses fixture Queue Batch Job test data.xlsx", async () => {
    const buffer = readFileSync(FIXTURE_XLSX)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const xlsxResult = parsePassportManifestXlsx(arrayBuffer, XLSX)
    expect(xlsxResult.ok).toBe(true)
    if (xlsxResult.ok) {
      expect(xlsxResult.rows[0]?.sku).toBe("SKU-LEATHER-001")
    }

    const xlsxFile = new File([buffer], "Queue Batch Job test data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const fileResult = await parsePassportManifestFile(xlsxFile)
    expect(fileResult.ok).toBe(true)
    if (fileResult.ok) {
      expect(fileResult.rows.some((r) => r.product_name === "Linen Summer Dress")).toBe(true)
    }
  })

  it("parses hyphenated and Excel-style batch column headers", () => {
    const variants = [
      ["product-name", "sku", "batch-id", "origin-geo", "description"],
      ["product_name", "sku", "Batch No.", "origin_geo", "description"],
      ["product_name", "sku", "Batch#", "origin_geo", "description"],
    ]

    for (const headerRow of variants) {
      const sheet = XLSX.utils.aoa_to_sheet([headerRow, ["Bag", "SKU-1", "B-1", "Florence", "Nice bag"]])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Manifest")
      const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
      const result = parsePassportManifestXlsx(buffer, XLSX)
      expect(result.ok, `failed for ${headerRow.join(",")}`).toBe(true)
      if (result.ok) expect(result.rows[0]?.batch_id).toBe("B-1")
    }
  })

  it("selects the worksheet with the best matching headers", () => {
    const cover = XLSX.utils.aoa_to_sheet([["Queue Batch Job test data", "", "", "", ""]])
    const data = XLSX.utils.aoa_to_sheet([
      ["Product Name", "SKU", "Batch ID", "Origin Geo", "Description"],
      ["Bag", "SKU-1", "B-1", "Florence", "Nice bag"],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, cover, "Cover")
    XLSX.utils.book_append_sheet(workbook, data, "Data")
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer

    const result = parsePassportManifestXlsx(buffer, XLSX)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rows[0]?.product_name).toBe("Bag")
  })

  it("parses native xlsx via sheet_to_json and normalized keys", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Product_Name", "SKU ", "Batch_ID", "Origin Geo", "Description"],
      ["Leather Bag", "SKU-1", "BATCH-1", "Florence", "Handmade tote"],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Manifest")
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer

    const result = parsePassportManifestXlsx(buffer, XLSX)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rows[0]?.origin_geo).toBe("Florence")
  })

  it("parses user-named Queue Batch Job test data fixtures", async () => {
    const userCsv = readFileSync(path.join(FIXTURE_DIR, "Queue Batch Job test data.csv"), "utf8")
    const userCsvResult = await parsePassportManifestFile(
      new File([userCsv], "Queue Batch Job test data.csv", { type: "text/csv" }),
    )
    expect(userCsvResult.ok).toBe(true)

    const userXlsx = readFileSync(path.join(FIXTURE_DIR, "Queue Batch Job test data.xlsx"))
    const userXlsxResult = await parsePassportManifestFile(
      new File([userXlsx], "Queue Batch Job test data.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    )
    expect(userXlsxResult.ok).toBe(true)
  })

  it("parses DPP compliance Excel exports with alternate column names", async () => {
    const headerRow = [
      "product_name",
      "sku",
      "batch_id",
      "origin_geo",
      "description",
      "brand_url",
      "category",
      "espr_compliance",
      "eudr_reference",
      "material_origin",
      "tanning_country",
    ]
    const sheet = XLSX.utils.aoa_to_sheet([
      headerRow,
      [
        "Artisan Leather Tote",
        "SKU-LEATHER-001",
        "EUDR-REF-001",
        "Italy · Florence",
        "ESPR-2026 compliant vegetable-tanned leather",
        "https://brand.example",
        "Leather",
        "ESPR-2026",
        "EUDR-REF-001",
        "Italy",
        "Florence",
      ],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, "Compliance Export")
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer

    const result = parsePassportManifestXlsx(buffer, XLSX)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows[0]?.product_name).toBe("Artisan Leather Tote")
      expect(result.rows[0]?.origin_geo).toContain("Italy")
      expect(result.rows[0]?.batch_id).toBe("EUDR-REF-001")
      expect(result.rows[0]?.description).toContain("ESPR-2026")
    }

    const file = new File([buffer], "Queue Batch Job test data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const fileResult = await parsePassportManifestFile(file)
    expect(fileResult.ok).toBe(true)
  })

  it("normalizeRowObjects cleans keys from either parser", () => {
    const normalized = normalizeRowObjects([
      {
        "Product_Name ": "Jacket",
        SKU: "SKU-9",
        batch_id: "B-1",
        "Origin Geo": "Lisbon",
        Description: "Wool",
      },
    ])
    expect(normalized[0]).toMatchObject({
      product_name: "Jacket",
      sku: "SKU-9",
      origin_geo: "Lisbon",
    })
  })

  it("parses six-row batch fixture with six unique manifest rows", async () => {
    const csvPath = path.join(FIXTURE_DIR, "six-row-batch.csv")
    const csvText = readFileSync(csvPath, "utf8")
    const result = parsePassportManifestCsv(csvText)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rows).toHaveLength(6)
      expect(result.uniqueCount).toBe(6)
    }
  })
})
