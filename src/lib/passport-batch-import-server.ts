import crypto from "crypto"
import { createHash } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateSerialId } from "@/lib/crypto"
import { sanitizeForFilename } from "@/lib/security"
import { PASSPORT_MANIFEST_MAX_ROWS } from "@/lib/passport-batch-manifest"
import { generateAndStorePassportQr } from "@/lib/passport-qr-server"
import type {
  PassportImportRow,
  PreparedPassportImportRecord,
} from "@/lib/passport-batch-import-types"

const MAX_ROWS = PASSPORT_MANIFEST_MAX_ROWS

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" || message.includes("column") || message.includes("schema cache")
}

export function preparePassportImportRecords(
  items: PassportImportRow[],
  manifestBatchId: string,
): PreparedPassportImportRecord[] {
  return items.slice(0, MAX_ROWS).map((row) => ({
    id: crypto.randomUUID(),
    product_name: row.product_name.trim(),
    sku: row.sku.trim(),
    batch_id: row.batch_id?.trim() || manifestBatchId,
    origin_geo: row.origin_geo?.trim() ?? "",
    description: row.description?.trim() ?? "",
    artisan_metadata: {
      artisan_identifier: row.artisan_identifier?.trim() || "Anonymous Master Artisan",
      generated_via: "CSV Bulk Ingestion Worker",
    },
    qr_secure_token: crypto.randomBytes(32).toString("hex"),
    activation_status: "draft" as const,
    created_at: new Date().toISOString(),
  }))
}

async function resolveOrCreateProduct(params: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
  organizationId: string | null
  record: PreparedPassportImportRecord
}): Promise<string | null> {
  const { admin, userId, organizationId, record } = params
  const sku = record.sku.trim()

  const { data: existingBySku } = await admin
    .from("products")
    .select("id")
    .eq("brand_id", userId)
    .eq("sku", sku)
    .maybeSingle()

  if (existingBySku?.id) return existingBySku.id

  const fullPayload: Record<string, unknown> = {
    brand_id: userId,
    organization_id: organizationId,
    name: record.product_name.trim(),
    sku,
    description: record.description?.trim() || null,
    origin: record.origin_geo.trim() || null,
    is_archived: false,
  }

  const { data: created, error } = await admin.from("products").insert(fullPayload).select("id").single()
  if (!error && created?.id) return created.id

  if (error && !isMissingColumnError(error)) return null

  const { data: fallback, error: fallbackError } = await admin
    .from("products")
    .insert({
      brand_id: userId,
      organization_id: organizationId,
      name: record.product_name.trim(),
      sku,
      origin: record.origin_geo.trim() || null,
      is_archived: false,
    })
    .select("id")
    .single()

  if (fallbackError || !fallback?.id) return null
  return fallback.id
}

async function insertPassportRecord(params: {
  admin: ReturnType<typeof createAdminClient>
  productId: string
  record: PreparedPassportImportRecord
  qrBatchJobId: string
}): Promise<string | null> {
  const { admin, productId, record, qrBatchJobId } = params
  const serialNumber = generateSerialId("OP")
  const blockchainHash = createHash("sha256").update(record.qr_secure_token).digest("hex")

  const metadata = {
    product_name: record.product_name,
    sku: record.sku,
    batch_id: record.batch_id,
    origin_geo: record.origin_geo,
    description: record.description ?? null,
    artisan_metadata: record.artisan_metadata,
    activation_status: record.activation_status,
    qr_secure_token: record.qr_secure_token,
    generated_via: record.artisan_metadata.generated_via,
    qr_batch_job_id: qrBatchJobId,
  }

  const withMetadata: Record<string, unknown> = {
    id: record.id,
    product_id: productId,
    serial_number: serialNumber,
    passport_uid: serialNumber,
    verify_token: record.qr_secure_token,
    blockchain_hash: blockchainHash,
    status: "active",
    metadata,
    created_at: new Date().toISOString(),
  }

  let result = await admin.from("passports").insert(withMetadata).select("id").single()
  if (!result.error && result.data?.id) return result.data.id

  if (result.error && isMissingColumnError(result.error)) {
    result = await admin
      .from("passports")
      .insert({
        id: record.id,
        product_id: productId,
        serial_number: serialNumber,
        passport_uid: serialNumber,
        verify_token: record.qr_secure_token,
        blockchain_hash: blockchainHash,
        status: "active",
        metadata: {
          product_name: record.product_name,
          sku: record.sku,
          batch_id: record.batch_id,
          qr_batch_job_id: qrBatchJobId,
        },
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single()
  }

  if (result.error || !result.data?.id) return null
  return result.data.id
}

export type PersistPassportImportResult = {
  jobId: string
  successCount: number
  failedCount: number
  passportIds: string[]
}

type QueuedImportPayload = {
  records: PreparedPassportImportRecord[]
  manifestBatchId: string
  userId: string
  organizationId: string | null
  jobName?: string
}

function parseImportPayload(metadata: Record<string, unknown> | null): QueuedImportPayload | null {
  if (!metadata || typeof metadata !== "object") return null
  const payload = metadata.import_payload
  if (!payload || typeof payload !== "object") return null
  const records = (payload as { records?: PreparedPassportImportRecord[] }).records
  const manifestBatchId = (payload as { manifestBatchId?: string }).manifestBatchId
  const userId = (payload as { userId?: string }).userId
  if (!Array.isArray(records) || !manifestBatchId || !userId) return null
  return {
    records,
    manifestBatchId,
    userId,
    organizationId: ((payload as { organizationId?: string | null }).organizationId ?? null) as
      | string
      | null,
    jobName: (payload as { jobName?: string }).jobName,
  }
}

/** Insert a processing job with validated manifest payload for the background worker. */
export async function queuePassportImportBatch(params: {
  userId: string
  organizationId: string | null
  manifestBatchId: string
  records: PreparedPassportImportRecord[]
  jobName?: string
}): Promise<{ jobId: string; jobName: string | null }> {
  const { userId, organizationId, manifestBatchId, records, jobName } = params
  const capped = records.slice(0, MAX_ROWS)
  const admin = createAdminClient()
  const resolvedJobName = jobName ?? `Passport manifest ${manifestBatchId}`

  const { data: job, error: jobError } = await admin
    .from("qr_batch_jobs")
    .insert({
      organization_id: organizationId,
      created_by: userId,
      job_name: resolvedJobName,
      input_count: capped.length,
      processed_count: 0,
      success_count: 0,
      failed_count: 0,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        source: "passport_manifest_import",
        manifest_batch_id: manifestBatchId,
        import_payload: {
          records: capped,
          manifestBatchId,
          userId,
          organizationId,
          jobName: resolvedJobName,
        },
      },
    })
    .select("id")
    .single()

  if (jobError || !job) {
    throw new Error(jobError?.message ?? "Could not create batch job.")
  }

  return { jobId: job.id as string, jobName: resolvedJobName }
}

/** Process a queued manifest job and finalize qr_batch_jobs status. */
export async function processPassportImportJob(jobId: string): Promise<PersistPassportImportResult> {
  const admin = createAdminClient()

  const { data: jobRow, error: loadError } = await admin
    .from("qr_batch_jobs")
    .select("id, status, metadata, job_name")
    .eq("id", jobId)
    .maybeSingle()

  if (loadError || !jobRow) {
    throw new Error(loadError?.message ?? "Batch job not found.")
  }

  const metadata = (jobRow.metadata ?? {}) as Record<string, unknown>
  const payload = parseImportPayload(metadata)
  if (!payload) {
    await admin
      .from("qr_batch_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Missing import payload.",
      })
      .eq("id", jobId)
    throw new Error("Missing import payload.")
  }

  if (jobRow.status === "completed" || jobRow.status === "failed") {
    return {
      jobId,
      successCount: 0,
      failedCount: 0,
      passportIds: [],
    }
  }

  await admin
    .from("qr_batch_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)

  const passportIds: string[] = []
  const qrExportRows: Array<{
    product_name: string
    sku: string
    serial_id: string
    passport_id: string
    public_url: string
    qr_code_id: string
    qr_identity_id: string | null
  }> = []
  let successCount = 0
  let failedCount = 0

  for (const record of payload.records) {
    try {
      const productId = await resolveOrCreateProduct({
        admin,
        userId: payload.userId,
        organizationId: payload.organizationId,
        record,
      })
      if (!productId) {
        failedCount += 1
        continue
      }

      const passportId = await insertPassportRecord({
        admin,
        productId,
        record,
        qrBatchJobId: jobId,
      })
      if (!passportId) {
        failedCount += 1
        continue
      }

      passportIds.push(passportId)
      successCount += 1

      try {
        const { data: passportRow } = await admin
          .from("passports")
          .select("serial_number")
          .eq("id", passportId)
          .maybeSingle()
        const qr = await generateAndStorePassportQr({
          passportId,
          organizationId: payload.organizationId,
          qrIdentityDisplayName: record.product_name,
          qrIdentityMetadata: {
            source: "passport_manifest_import",
            manifest_batch_id: payload.manifestBatchId,
            qr_batch_job_id: jobId,
          },
        })
        qrExportRows.push({
          product_name: record.product_name,
          sku: record.sku,
          serial_id: String(passportRow?.serial_number ?? ""),
          passport_id: passportId,
          public_url: qr.publicPageUrl,
          qr_code_id: qr.qrCodeRowId,
          qr_identity_id: qr.qrIdentityId ?? null,
        })
      } catch (qrErr) {
        console.error("[passport-batch-import] QR mint failed for", passportId, qrErr)
      }
    } catch {
      failedCount += 1
    }
  }

  const finalStatus = successCount > 0 ? "completed" : "failed"
  const resolvedJobName =
    payload.jobName ??
    (typeof jobRow.job_name === "string" ? jobRow.job_name : null) ??
    `Passport manifest ${payload.manifestBatchId}`
  const exportFolderName = sanitizeForFilename(resolvedJobName)

  await admin
    .from("qr_batch_jobs")
    .update({
      processed_count: payload.records.length,
      success_count: successCount,
      failed_count: failedCount,
      status: finalStatus,
      completed_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        source: "passport_manifest_import",
        manifest_batch_id: payload.manifestBatchId,
        export_folder_name: exportFolderName,
        import_passport_ids: passportIds,
        passport_ids: passportIds,
        qr_export_rows: qrExportRows,
        activation_status: qrExportRows.length > 0 ? "active" : "draft",
        assets_generated_at:
          qrExportRows.length > 0 ? new Date().toISOString() : metadata.assets_generated_at ?? null,
      },
    })
    .eq("id", jobId)

  return {
    jobId,
    successCount,
    failedCount,
    passportIds,
  }
}

/** Legacy synchronous entry — queues then processes inline (API compatibility). */
export async function persistPassportImportBatch(params: {
  userId: string
  organizationId: string | null
  manifestBatchId: string
  records: PreparedPassportImportRecord[]
  jobName?: string
}): Promise<PersistPassportImportResult> {
  const { jobId } = await queuePassportImportBatch(params)
  return processPassportImportJob(jobId)
}
