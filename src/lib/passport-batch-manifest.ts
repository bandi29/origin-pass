import Papa from "papaparse"

export const PASSPORT_MANIFEST_HEADERS = [
  "product_name",
  "sku",
  "batch_id",
  "origin_geo",
  "description",
] as const

/** Strict manifest columns required before a batch job can be queued. */
export const PASSPORT_REQUIRED_HEADERS = [
  "product_name",
  "sku",
  "batch_id",
  "origin_geo",
  "description",
] as const

export const PASSPORT_MANIFEST_MAX_ROWS = 1000

export type PassportManifestRow = {
  product_name: string
  sku: string
  batch_id: string
  origin_geo: string
  description: string
  artisan_identifier?: string
}

export type PassportManifestParseResult =
  | { ok: true; rows: PassportManifestRow[]; uniqueCount: number }
  | { ok: false; error: string }

export type ManifestFileKind = "csv" | "xlsx" | "unknown"

type RawRow = Record<string, unknown>

const CSV_DELIMITER_CANDIDATES = [",", ";", "\t", "|"] as const

/** Common spreadsheet header aliases → canonical manifest keys */
const HEADER_ALIASES: Record<string, string> = {
  product: "product_name",
  productname: "product_name",
  product_title: "product_name",
  product_name: "product_name",
  item_name: "product_name",
  name: "product_name",
  batch: "batch_id",
  batch_number: "batch_id",
  batch_no: "batch_id",
  batch_num: "batch_id",
  batch_code: "batch_id",
  batchid: "batch_id",
  lot: "batch_id",
  lot_id: "batch_id",
  lot_number: "batch_id",
  production_batch: "batch_id",
  eudr_reference: "eudr_reference",
  espr_compliance: "espr_compliance",
  material_origin: "material_origin",
  tanning_country: "tanning_country",
  origin_country: "origin_geo",
  country_of_origin: "origin_geo",
  origin: "origin_geo",
  geographic_origin: "origin_geo",
  geo: "origin_geo",
  origingeo: "origin_geo",
  origin_location: "origin_geo",
  location: "origin_geo",
  desc: "description",
  details: "description",
  detail: "description",
}

/** Trim, lowercase, collapse whitespace/punctuation — handles "Batch ID", "batch-id", "Batch No." */
export function normalizeHeader(value: string): string {
  return String(value ?? "")
    .replace(/[\uFEFF\u200B-\u200D\u2060\u00A0]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[#]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

export function resolveHeaderAlias(header: string): string {
  const normalized = normalizeHeader(header)
  if (!normalized) return ""
  return HEADER_ALIASES[normalized] ?? normalized
}

function resolveRecordKeys(record: RawRow): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, raw] of Object.entries(record)) {
    const header = resolveHeaderAlias(key)
    if (!header || header.startsWith("__empty")) continue
    normalized[header] = String(raw ?? "").trim()
  }
  return normalized
}

function enrichManifestFields(normalized: Record<string, string>): Record<string, string> {
  const out = { ...normalized }

  if (!out.origin_geo?.trim()) {
    const originParts = [normalized.material_origin, normalized.tanning_country].filter(
      (value) => value?.trim(),
    )
    if (originParts.length > 0) out.origin_geo = originParts.join(" · ")
  }

  if (!out.description?.trim()) {
    const descriptionParts = [
      normalized.description,
      normalized.espr_compliance,
      normalized.eudr_reference,
      normalized.category,
    ].filter((value) => value?.trim())
    if (descriptionParts.length > 0) out.description = descriptionParts.join(" · ")
  }

  if (!out.batch_id?.trim() && normalized.eudr_reference?.trim()) {
    out.batch_id = normalized.eudr_reference.trim()
  }

  out.batch_id = out.batch_id?.trim() ?? ""
  out.origin_geo = out.origin_geo?.trim() ?? ""
  out.description = out.description?.trim() ?? ""

  return out
}

/** Map raw parser output to clean keyed rows for validation. */
export function normalizeRowObjects(rows: RawRow[]): Record<string, string>[] {
  return rows
    .map((row) => enrichManifestFields(resolveRecordKeys(row)))
    .filter((row) => Object.keys(row).length > 0)
}

export function formatMissingManifestColumnError(missingColumn: string): string {
  return `Missing required column "${missingColumn}". Expected: ${PASSPORT_REQUIRED_HEADERS.join(", ")}`
}

export function validateManifestHeaders(headers: string[]): string | null {
  const normalized = new Set(headers.map(resolveHeaderAlias).filter(Boolean))
  for (const required of PASSPORT_REQUIRED_HEADERS) {
    if (!normalized.has(required)) {
      return formatMissingManifestColumnError(required)
    }
  }
  return null
}

function canImportWithHeaders(headers: string[]): boolean {
  return validateManifestHeaders(headers) === null
}

function collectHeadersFromRaw(rows: RawRow[]): string[] {
  const headerSet = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const header = resolveHeaderAlias(key)
      if (header && !header.startsWith("__empty")) headerSet.add(header)
    }
  }
  return Array.from(headerSet)
}

function collectHeadersFromNormalized(rows: Record<string, string>[]): string[] {
  const headerSet = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) headerSet.add(resolveHeaderAlias(key))
  }
  return Array.from(headerSet)
}

function rowFromNormalizedRecord(normalized: Record<string, string>): PassportManifestRow | null {
  const product_name = normalized.product_name
  const sku = normalized.sku
  if (!product_name || !sku) return null
  return {
    product_name,
    sku,
    batch_id: normalized.batch_id ?? "",
    origin_geo: normalized.origin_geo ?? "",
    description: normalized.description ?? "",
    artisan_identifier: normalized.artisan_identifier || undefined,
  }
}

function uniqueManifestKey(row: PassportManifestRow): string {
  return `${row.sku.toLowerCase()}::${row.batch_id.toLowerCase()}`
}

export function countUniqueManifestRows(rows: PassportManifestRow[]): number {
  return new Set(rows.map(uniqueManifestKey)).size
}

function validateAndBuildManifestRows(
  normalizedRows: Record<string, string>[],
  declaredHeaders: string[] = [],
): PassportManifestParseResult {
  if (normalizedRows.length === 0) {
    return { ok: false, error: "No rows found in file." }
  }

  if (normalizedRows.length > PASSPORT_MANIFEST_MAX_ROWS) {
    return {
      ok: false,
      error: `File exceeds the ${PASSPORT_MANIFEST_MAX_ROWS.toLocaleString()} row limit (${normalizedRows.length.toLocaleString()} rows found).`,
    }
  }

  const headers =
    declaredHeaders.length > 0
      ? declaredHeaders.map(resolveHeaderAlias).filter(Boolean)
      : collectHeadersFromNormalized(normalizedRows)

  const headerError = validateManifestHeaders(headers)
  if (headerError) return { ok: false, error: headerError }

  const rows = normalizedRows
    .map(enrichManifestFields)
    .map(rowFromNormalizedRecord)
    .filter((row): row is PassportManifestRow => row !== null)

  if (rows.length === 0) {
    return { ok: false, error: "No valid rows found. Each row needs product_name and sku." }
  }

  return { ok: true, rows, uniqueCount: countUniqueManifestRows(rows) }
}

function scoreDelimiterFields(fields: string[]): number {
  const normalized = new Set(fields.map(resolveHeaderAlias))
  let score = PASSPORT_REQUIRED_HEADERS.filter((h) => normalized.has(h)).length * 10
  score += PASSPORT_MANIFEST_HEADERS.filter((h) => normalized.has(h)).length
  // Compliance / DPP export columns common in Excel workbooks
  for (const key of ["material_origin", "tanning_country", "espr_compliance", "eudr_reference"]) {
    if (normalized.has(key)) score += 1
  }
  return score
}

/** Pick delimiter that best matches required manifest columns (handles Excel ;-csv exports). */
export function detectCsvDelimiter(text: string): string {
  const sample = text.slice(0, 8192)
  let bestDelimiter: string = ","
  let bestScore = -1

  for (const delimiter of CSV_DELIMITER_CANDIDATES) {
    const parsed = Papa.parse<RawRow>(sample, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      preview: 8,
    })
    const score = scoreDelimiterFields(parsed.meta.fields ?? [])
    if (score > bestScore) {
      bestScore = score
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

function parseCsvMatrix(text: string, delimiter: string): string[][] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter,
  })
  return (parsed.data ?? []) as string[][]
}

function headerRowScore(cells: string[]): number {
  const normalized = cells.map((cell) => resolveHeaderAlias(String(cell ?? "")))
  return scoreDelimiterFields(normalized)
}

function matrixToRawRows(matrix: string[][]): { headers: string[]; rows: RawRow[] } {
  let headerRowIndex = -1
  let bestScore = -1

  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const score = headerRowScore(matrix[i] ?? [])
    if (score > bestScore) {
      bestScore = score
      headerRowIndex = i
    }
    if (score === PASSPORT_MANIFEST_HEADERS.length) break
  }

  if (headerRowIndex < 0) headerRowIndex = 0

  const headers = (matrix[headerRowIndex] ?? []).map((cell) =>
    resolveHeaderAlias(String(cell ?? "")),
  )
  const rows: RawRow[] = []

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex++) {
    const line = matrix[rowIndex] ?? []
    if (!line.some((cell) => String(cell ?? "").trim() !== "")) continue

    const record: RawRow = {}
    headers.forEach((header, colIndex) => {
      if (!header || header.startsWith("__empty")) return
      record[header] = line[colIndex] ?? ""
    })
    if (Object.keys(record).length > 0) rows.push(record)
  }

  return { headers: headers.filter(Boolean), rows }
}

function extractRowsFromCsvText(text: string): { headers: string[]; rows: RawRow[] } | { error: string } {
  const cleaned = text.replace(/^\uFEFF/, "")
  const delimiter = detectCsvDelimiter(cleaned)

  const parsed = Papa.parse<RawRow>(cleaned, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter,
    transformHeader: (header) => resolveHeaderAlias(header),
  })

  if (parsed.errors.length > 0 && (parsed.data ?? []).length === 0) {
    return { error: parsed.errors[0]?.message ?? "Could not parse CSV." }
  }

  const declaredHeaders = (parsed.meta.fields ?? []).map(resolveHeaderAlias).filter(Boolean)
  const headerError = validateManifestHeaders(declaredHeaders)

  if (headerError) {
    const matrix = parseCsvMatrix(cleaned, delimiter)
    const matrixResult = matrixToRawRows(matrix)
    const matrixHeaderError = validateManifestHeaders(matrixResult.headers)
    if (matrixHeaderError) {
      return { error: matrixHeaderError }
    }
    return { headers: matrixResult.headers, rows: matrixResult.rows }
  }

  return { headers: declaredHeaders, rows: parsed.data ?? [] }
}

async function extractRowsFromCsv(file: File): Promise<{ headers: string[]; rows: RawRow[] } | { error: string }> {
  try {
    const text = await file.text()
    return extractRowsFromCsvText(text)
  } catch {
    return { error: "Could not read this CSV file. Check the encoding and try again." }
  }
}

async function extractRowsFromXlsx(file: File): Promise<{ headers: string[]; rows: RawRow[] } | { error: string }> {
  try {
    const buffer = await file.arrayBuffer()
    const XLSX = await import("xlsx")
    return extractRowsFromXlsxBuffer(buffer, XLSX)
  } catch {
    return { error: "We couldn't read this Excel workbook. Try saving as .xlsx or export to .csv." }
  }
}

type WorksheetExtract = {
  headers: string[]
  rows: RawRow[]
  score: number
}

function extractRowsFromWorksheet(
  worksheet: import("xlsx").WorkSheet,
  XLSX: typeof import("xlsx"),
): WorksheetExtract | null {
  const jsonData = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: "" })
  if (jsonData.length > 0) {
    const declaredHeaders = collectHeadersFromRaw(jsonData)
    const score = scoreDelimiterFields(declaredHeaders)
    if (!validateManifestHeaders(declaredHeaders)) {
      return { headers: declaredHeaders, rows: jsonData, score }
    }
    // Partial match (e.g. compliance export with product_name + sku) — keep for matrix retry
    if (canImportWithHeaders(declaredHeaders) && score > 0) {
      return { headers: declaredHeaders, rows: jsonData, score }
    }
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }) as string[][]

  if (matrix.length === 0) return null

  const matrixStrings = matrix.map((row) => row.map((cell) => String(cell ?? "")))
  const matrixResult = matrixToRawRows(matrixStrings)
  if (matrixResult.rows.length === 0) return null

  return {
    headers: matrixResult.headers,
    rows: matrixResult.rows,
    score: scoreDelimiterFields(matrixResult.headers),
  }
}

function extractRowsFromXlsxBuffer(
  buffer: ArrayBuffer,
  XLSX: typeof import("xlsx"),
): { headers: string[]; rows: RawRow[] } | { error: string } {
  let workbook: import("xlsx").WorkBook
  try {
    workbook = XLSX.read(buffer, { type: "array" })
  } catch {
    return { error: "We couldn't read this Excel workbook." }
  }

  if (workbook.SheetNames.length === 0) return { error: "Spreadsheet is empty." }

  let best: WorksheetExtract | null = null

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue

    const extracted = extractRowsFromWorksheet(worksheet, XLSX)
    if (!extracted) continue

    if (!validateManifestHeaders(extracted.headers)) {
      return { headers: extracted.headers, rows: extracted.rows }
    }

    if (canImportWithHeaders(extracted.headers) && extracted.rows.length > 0) {
      return { headers: extracted.headers, rows: extracted.rows }
    }

    if (!best || extracted.score > best.score) best = extracted
  }

  if (best && canImportWithHeaders(best.headers) && best.rows.length > 0) {
    return { headers: best.headers, rows: best.rows }
  }

  if (best) {
    const err = validateManifestHeaders(best.headers)
    return { error: err ?? "Could not find required columns in workbook." }
  }

  return { error: "No rows found in workbook. Check that the first row contains column headers." }
}

/** Extension-first file type detection for upload/drop handlers. */
export function detectManifestFileKind(file: File): ManifestFileKind {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith(".csv")) return "csv"
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".xlsm")) {
    return "xlsx"
  }

  const mime = file.type.toLowerCase()
  if (mime === "text/csv" || mime === "application/csv") return "csv"
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.ms-excel.sheet.macroenabled.12"
  ) {
    return "xlsx"
  }

  return "unknown"
}

/**
 * Unified import handler: extract rows by extension → normalize keys → validate required columns.
 * Used by the Bulk Import modal `handleFileSelect`.
 */
export async function parsePassportManifestFile(file: File): Promise<PassportManifestParseResult> {
  const fileName = file.name.toLowerCase()
  let extracted: { headers: string[]; rows: RawRow[] } | { error: string }

  if (fileName.endsWith(".csv")) {
    extracted = await extractRowsFromCsv(file)
  } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".xlsm")) {
    extracted = await extractRowsFromXlsx(file)
  } else {
    const kind = detectManifestFileKind(file)
    if (kind === "csv") extracted = await extractRowsFromCsv(file)
    else if (kind === "xlsx") extracted = await extractRowsFromXlsx(file)
    else return { ok: false, error: "Unsupported file type. Upload a .csv or .xlsx manifest." }
  }

  if ("error" in extracted) {
    return { ok: false, error: extracted.error }
  }

  const normalizedRows = normalizeRowObjects(extracted.rows)
  return validateAndBuildManifestRows(normalizedRows, extracted.headers)
}

// --- Test / legacy exports ---

export function normalizeRecord(record: Record<string, unknown>): Record<string, string> {
  return normalizeRowObjects([record])[0] ?? {}
}

export function parsePassportManifestCsv(text: string): PassportManifestParseResult {
  const extracted = extractRowsFromCsvText(text)
  if ("error" in extracted) return { ok: false, error: extracted.error }
  return validateAndBuildManifestRows(normalizeRowObjects(extracted.rows), extracted.headers)
}

export function parsePassportManifestXlsx(
  buffer: ArrayBuffer,
  XLSX: typeof import("xlsx"),
): PassportManifestParseResult {
  const extracted = extractRowsFromXlsxBuffer(buffer, XLSX)
  if ("error" in extracted) return { ok: false, error: extracted.error }
  return validateAndBuildManifestRows(normalizeRowObjects(extracted.rows), extracted.headers)
}
