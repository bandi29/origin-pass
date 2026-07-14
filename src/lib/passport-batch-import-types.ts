/** DPP row shape accepted by POST /api/passports/batch-import */
export interface PassportImportRow {
  product_name: string
  sku: string
  batch_id: string
  origin_geo: string
  artisan_identifier?: string
  description?: string
}

/** Normalized record prepared for persistence after CSV ingest */
export interface PreparedPassportImportRecord {
  id: string
  product_name: string
  sku: string
  batch_id: string
  origin_geo: string
  description?: string
  artisan_metadata: {
    artisan_identifier: string
    generated_via: string
  }
  qr_secure_token: string
  activation_status: "draft"
  created_at: string
}
