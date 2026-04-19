export const IMPORT_FIELD_KEYS = [
  "product_name",
  "product_id",
  "category",
  "brand",
  "origin_country",
  "material",
  "batch_number",
  "manufacture_date",
  "certifications",
  "qr_code",
] as const

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number]

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = [
  "product_name",
  "product_id",
  "category",
  "brand",
  "origin_country",
]

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>

export type RawRow = Record<string, string>

export type MappedRow = {
  product_name: string
  product_id: string
  category: string
  brand: string
  origin_country: string
  material: string | null
  batch_number: string | null
  manufacture_date: string | null
  certifications: unknown
  qr_code: string | null
}

export type RowValidationError = {
  rowIndex: number
  field?: string
  message: string
}

export type ValidateResult = {
  totalRows: number
  validRows: number
  failedRows: number
  errors: RowValidationError[]
  mappedPreview: MappedRow[]
}
