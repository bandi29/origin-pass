import crypto from "crypto"
import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateSerialId } from "@/lib/crypto"
import { generateAndStorePassportQr } from "@/lib/passport-qr-server"
import type { ColumnMapping } from "@/lib/import-products/types"

export type ImportPipelineStage = "catalog" | "passports" | "qr" | "done"

export type ImportQrExportRow = {
  product_name: string
  sku: string
  serial_id: string
  passport_id: string
  public_url: string
  qr_code_id: string
  qr_identity_id: string | null
}

export type ImportPipelineState = {
  stage: ImportPipelineStage
  productsTotal: number
  productsDone: number
  passportsDone: number
  qrDone: number
  passportIds: string[]
  exportRows: ImportQrExportRow[]
  exportReady: boolean
}

type CatalogProductRow = {
  id: string
  name: string | null
  sku: string | null
  origin: string | null
  origin_country: string | null
  batch_number: string | null
  description: string | null
  materials: string | null
  category: string | null
  brand: string | null
  compliance_data: Record<string, unknown> | null
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" || message.includes("column") || message.includes("schema cache")
}

function buildDefaultComplianceData(product: CatalogProductRow): Record<string, unknown> {
  const origin = product.origin_country?.trim() || product.origin?.trim() || ""
  const materials = product.materials?.trim() || ""
  return {
    product_story: product.description?.trim() || product.name?.trim() || "",
    origin_country: origin,
    fiber_composition: materials || undefined,
    primary_material_descriptor: materials || undefined,
    import_source: "catalog_csv_pipeline",
  }
}

async function ensureProductComplianceTemplate(
  admin: SupabaseClient,
  product: CatalogProductRow,
): Promise<void> {
  const existing = product.compliance_data ?? {}
  if (Object.keys(existing).length > 0) return
  const complianceData = buildDefaultComplianceData(product)
  await admin.from("products").update({ compliance_data: complianceData }).eq("id", product.id)
}

async function findExistingPassportId(
  admin: SupabaseClient,
  productId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("passports")
    .select("id")
    .eq("product_id", productId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function insertPassportForCatalogProduct(params: {
  admin: SupabaseClient
  product: CatalogProductRow
  importLogId: string
}): Promise<string | null> {
  const { admin, product, importLogId } = params
  const existing = await findExistingPassportId(admin, product.id)
  if (existing) return existing

  const qrSecureToken = crypto.randomBytes(32).toString("hex")
  const serialNumber = generateSerialId("OP")
  const blockchainHash = createHash("sha256").update(qrSecureToken).digest("hex")
  const batchId = product.batch_number?.trim() || `IMPORT-${importLogId.slice(0, 8).toUpperCase()}`

  const metadata = {
    product_name: product.name?.trim() ?? "",
    sku: product.sku?.trim() ?? "",
    batch_id: batchId,
    origin_geo: product.origin_country?.trim() || product.origin?.trim() || "",
    description: product.description?.trim() ?? null,
    artisan_metadata: {
      artisan_identifier: "Catalog CSV Import",
      generated_via: "Automated catalog import pipeline",
    },
    activation_status: "active",
    qr_secure_token: qrSecureToken,
    import_log_id: importLogId,
    generated_via: "Automated catalog import pipeline",
  }

  const payload: Record<string, unknown> = {
    product_id: product.id,
    serial_number: serialNumber,
    passport_uid: serialNumber,
    verify_token: qrSecureToken,
    blockchain_hash: blockchainHash,
    status: "active",
    metadata,
    created_at: new Date().toISOString(),
  }

  let result = await admin.from("passports").insert(payload).select("id, serial_number").single()
  if (result.error && isMissingColumnError(result.error)) {
    result = await admin
      .from("passports")
      .insert({
        product_id: product.id,
        serial_number: serialNumber,
        passport_uid: serialNumber,
        verify_token: qrSecureToken,
        blockchain_hash: blockchainHash,
        status: "active",
        metadata: {
          product_name: product.name,
          sku: product.sku,
          batch_id: batchId,
          import_log_id: importLogId,
        },
        created_at: new Date().toISOString(),
      })
      .select("id, serial_number")
      .single()
  }

  if (result.error || !result.data?.id) return null
  return result.data.id as string
}

export function mergePipelineIntoMapping(
  columnMapping: ColumnMapping,
  pipeline: ImportPipelineState,
): Record<string, unknown> {
  return {
    ...(columnMapping as Record<string, unknown>),
    _pipeline: pipeline,
  }
}

export function readPipelineFromMapping(mapping: unknown): ImportPipelineState | null {
  if (!mapping || typeof mapping !== "object") return null
  const pipeline = (mapping as { _pipeline?: ImportPipelineState })._pipeline
  if (!pipeline || typeof pipeline !== "object") return null
  return pipeline
}

export async function persistPipelineState(
  admin: SupabaseClient,
  importLogId: string,
  columnMapping: ColumnMapping,
  pipeline: ImportPipelineState,
): Promise<void> {
  await admin
    .from("product_import_logs")
    .update({ mapping: mergePipelineIntoMapping(columnMapping, pipeline) })
    .eq("id", importLogId)
}

export async function runImportCatalogPipeline(params: {
  admin: SupabaseClient
  importLogId: string
  organizationId: string | null
  columnMapping: ColumnMapping
  initialState: ImportPipelineState
  onProgress: (pipeline: ImportPipelineState) => Promise<void>
}): Promise<ImportPipelineState> {
  const { admin, importLogId, organizationId, columnMapping, onProgress } = params
  let state: ImportPipelineState = { ...params.initialState, stage: "passports" }
  await onProgress(state)

  const { data: products, error } = await admin
    .from("products")
    .select(
      "id, name, sku, origin, origin_country, batch_number, description, materials, category, brand, compliance_data",
    )
    .eq("import_log_id", importLogId)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(error.message || "Could not load imported products.")
  }

  const rows = (products ?? []) as CatalogProductRow[]
  state = {
    ...state,
    productsTotal: rows.length,
    productsDone: rows.length,
    passportsDone: 0,
    qrDone: 0,
    passportIds: [],
    exportRows: [],
    exportReady: false,
  }
  await onProgress(state)

  for (const product of rows) {
    await ensureProductComplianceTemplate(admin, product)
    const passportId = await insertPassportForCatalogProduct({
      admin,
      product,
      importLogId,
    })
    if (!passportId) continue
    state.passportIds.push(passportId)
    state.passportsDone += 1
    await onProgress({ ...state })
  }

  state = { ...state, stage: "qr", qrDone: 0 }
  await onProgress(state)

  for (const passportId of state.passportIds) {
    const { data: passport } = await admin
      .from("passports")
      .select("id, serial_number, product_id, product:products(name, sku)")
      .eq("id", passportId)
      .maybeSingle()

    if (!passport?.id) continue

    const productJoin = passport.product as
      | { name?: string | null; sku?: string | null }
      | { name?: string | null; sku?: string | null }[]
      | null
    const productRow = Array.isArray(productJoin) ? productJoin[0] : productJoin

    try {
      const qr = await generateAndStorePassportQr({
        passportId,
        organizationId,
        qrIdentityDisplayName: productRow?.name?.trim() || null,
        qrIdentityMetadata: {
          source: "catalog_csv_import",
          import_log_id: importLogId,
        },
      })

      state.exportRows.push({
        product_name: productRow?.name?.trim() || "",
        sku: productRow?.sku?.trim() || "",
        serial_id: String(passport.serial_number ?? ""),
        passport_id: passportId,
        public_url: qr.publicPageUrl,
        qr_code_id: qr.qrCodeRowId,
        qr_identity_id: qr.qrIdentityId ?? null,
      })
      state.qrDone += 1
      await onProgress({ ...state })
    } catch (err) {
      console.error("[import-catalog-pipeline] QR mint failed for", passportId, err)
    }
  }

  state = {
    ...state,
    stage: "done",
    exportReady: state.exportRows.length > 0,
  }
  await persistPipelineState(admin, importLogId, columnMapping, state)
  await onProgress(state)
  return state
}

export function buildImportQrExportCsv(rows: ImportQrExportRow[]): string {
  const header = [
    "product_name",
    "sku",
    "serial_id",
    "passport_id",
    "public_url",
    "qr_code_id",
    "qr_identity_id",
  ]
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = [header.join(",")]
  for (const row of rows) {
    lines.push(
      [
        row.product_name,
        row.sku,
        row.serial_id,
        row.passport_id,
        row.public_url,
        row.qr_code_id,
        row.qr_identity_id ?? "",
      ]
        .map((cell) => escape(String(cell ?? "")))
        .join(","),
    )
  }
  return lines.join("\n")
}
