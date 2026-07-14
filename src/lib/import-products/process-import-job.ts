import { createReadStream, readFileSync } from "node:fs"
import { parse } from "csv-parse"
import * as XLSX from "xlsx"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ColumnMapping } from "@/lib/import-products/types"
import { REQUIRED_IMPORT_FIELDS } from "@/lib/import-products/types"
import { isMappingComplete } from "@/lib/import-products/mapping"
import {
  applyMapping,
  validateMappedRows,
} from "@/lib/import-products/validate"
import { sheetToStringRecordRows } from "@/lib/import-products/xlsx-smart"
import { mappedRowsToMergeJson } from "@/lib/import-products/build-merge-json"
import { materialiseImportFileToLocal } from "@/lib/import-products/storage"
import {
  persistVerificationOutputs,
  runVerificationOrchestrator,
} from "@/backend/modules/verification-engine"
import {
  persistPipelineState,
  runImportCatalogPipeline,
  type ImportPipelineState,
} from "@/lib/import-products/import-catalog-pipeline"

const CHUNK_ROWS = 400
const RPC_BATCH = 120
const PARALLEL_CHUNKS = 3

async function getOrganizationIdAdmin(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("organization_id").eq("id", userId).maybeSingle()
  return data?.organization_id ?? null
}

type JobRow = {
  id: string
  user_id: string
  brand_id: string
  organization_id: string | null
  file_url: string
  file_name: string
  mapping: ColumnMapping
  product_import_log_id: string | null
  status: string
}

async function loadJob(jobId: string): Promise<JobRow | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("import_jobs")
    .select(
      "id, user_id, brand_id, organization_id, file_url, file_name, mapping, product_import_log_id, status",
    )
    .eq("id", jobId)
    .maybeSingle()
  if (error || !data) return null
  return data as JobRow
}

async function patchJob(
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("import_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId)
}

async function appendErrors(
  jobId: string,
  rows: { row_number: number; error_message: string; raw_data: Record<string, unknown> }[],
): Promise<void> {
  if (rows.length === 0) return
  const admin = createAdminClient()
  const { error } = await admin.from("import_errors").insert(
    rows.map((r) => ({
      job_id: jobId,
      row_number: r.row_number,
      error_message: r.error_message,
      raw_data: r.raw_data,
    })),
  )
  if (error) console.error("import_errors insert", error)
}

function isXlsx(name: string): boolean {
  return name.toLowerCase().endsWith(".xlsx")
}

async function* iterateRowsFromFile(
  absPath: string,
  fileName: string,
): AsyncGenerator<{ row: Record<string, string>; rowNumber: number }> {
  if (isXlsx(fileName)) {
    const buf = readFileSync(absPath)
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return
    const sheet = wb.Sheets[sheetName]
    const { headers, rows } = sheetToStringRecordRows(sheet)
    if (!headers.length || !rows.length) return
    let idx = 0
    for (const row of rows) {
      idx++
      yield { row, rowNumber: idx }
    }
    return
  }

  const stream = createReadStream(absPath, { encoding: "utf8" })
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })
  let rowNumber = 0
  const iterable = stream.pipe(parser) as AsyncIterable<Record<string, unknown>>

  for await (const rec of iterable) {
    rowNumber++
    const row: Record<string, string> = {}
    for (const [k, v] of Object.entries(rec)) {
      row[k.trim()] = v == null ? "" : String(v)
    }
    yield { row, rowNumber }
  }
}

async function mergeRpc(
  brandId: string,
  organizationId: string | null,
  importLogId: string,
  jsonRows: Record<string, unknown>[],
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("merge_products_import_batch", {
    p_brand_id: brandId,
    p_organization_id: organizationId,
    p_import_log_id: importLogId,
    p_rows: jsonRows,
  })
  if (error) {
    return { ok: false, message: error.message }
  }
  const n = typeof data === "number" ? data : Number(data)
  return { ok: true, count: Number.isFinite(n) ? n : jsonRows.length }
}

async function processChunk(
  job: JobRow,
  mapping: ColumnMapping,
  chunk: { raw: Record<string, string>; rowNumber: number }[],
  profileBrandName: string | null,
  existingSkus: Set<string>,
): Promise<{ success: number; failed: number }> {
  const rows = chunk.map((c) => c.raw)
  const validation = validateMappedRows(rows, mapping, existingSkus, { allowExistingSkus: true })
  const invalid = new Set<number>()
  for (const e of validation.errors) invalid.add(e.rowIndex)

  let success = 0
  let failed = 0
  const errorRows: {
    row_number: number
    error_message: string
    raw_data: Record<string, unknown>
  }[] = []

  const toMerge: { mapped: ReturnType<typeof applyMapping>; rowNumber: number }[] = []
  for (let i = 0; i < chunk.length; i++) {
    if (invalid.has(i)) {
      failed++
      const errs = validation.errors.filter((e) => e.rowIndex === i)
      errorRows.push({
        row_number: chunk[i]!.rowNumber,
        error_message: errs.map((e) => e.message).join("; ") || "Validation failed",
        raw_data: chunk[i]!.raw,
      })
      continue
    }
    const mapped = applyMapping(chunk[i]!.raw, mapping)
    if (!mapped.product_id?.trim()) {
      failed++
      errorRows.push({
        row_number: chunk[i]!.rowNumber,
        error_message: "Missing product_id (SKU)",
        raw_data: chunk[i]!.raw,
      })
      continue
    }
    toMerge.push({ mapped, rowNumber: chunk[i]!.rowNumber })
  }

  for (let i = 0; i < toMerge.length; i += RPC_BATCH) {
    const slice = toMerge.slice(i, i + RPC_BATCH)
    const jsonPayload = mappedRowsToMergeJson(
      slice.map((s) => s.mapped),
      profileBrandName,
    )
    const r = await mergeRpc(
      job.brand_id,
      job.organization_id,
      job.product_import_log_id!,
      jsonPayload,
    )
    if (r.ok) {
      success += r.count
      for (const s of slice) {
        existingSkus.add(s.mapped.product_id.trim().toLowerCase())
      }
    } else {
      for (const s of slice) {
        failed++
        errorRows.push({
          row_number: s.rowNumber,
          error_message: r.message,
          raw_data: s.mapped as unknown as Record<string, unknown>,
        })
      }
    }
  }

  if (errorRows.length) await appendErrors(job.id, errorRows)

  return { success, failed }
}

async function runPostImportVerification(job: JobRow): Promise<void> {
  const admin = createAdminClient()
  if (!job.product_import_log_id) return

  const { data: importedProducts } = await admin
    .from("products")
    .select("id, sku, serial_number, origin_country, supplier_id, risk_score")
    .eq("import_log_id", job.product_import_log_id)
    .order("created_at", { ascending: false })
    .limit(250)

  for (const row of importedProducts ?? []) {
    const product = row as {
      id: string
      sku: string | null
      serial_number: string | null
      origin_country: string | null
      supplier_id: string | null
      risk_score: number | null
    }
    const orchestrator = await runVerificationOrchestrator(
      {
        supabase: admin,
        organizationId: job.organization_id ?? null,
        actor: job.user_id,
      },
      {
        currentRiskScore: Number(product.risk_score ?? 0),
        product: {
          productId: product.id,
          sku: product.sku,
          serialNumber: product.serial_number,
          originCountry: product.origin_country,
          supplierId: product.supplier_id,
        },
      },
    )

    await persistVerificationOutputs(
      {
        supabase: admin,
        organizationId: job.organization_id ?? null,
        actor: job.user_id,
      },
      product.id,
      orchestrator,
    )

    await admin
      .from("products")
      .update({
        risk_score: orchestrator.riskAfter,
        verification_status: orchestrator.status,
      })
      .eq("id", product.id)
  }
}

export async function processImportJob(jobId: string): Promise<void> {
  const job = await loadJob(jobId)
  if (!job) {
    console.error("import job not found", jobId)
    return
  }
  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "PARTIAL_SUCCESS") {
    return
  }

  const mapping = job.mapping as ColumnMapping
  const complete = isMappingComplete(mapping, REQUIRED_IMPORT_FIELDS)
  if (!complete.ok) {
    await patchJob(jobId, {
      status: "FAILED",
      last_error: "Incomplete mapping",
    })
    return
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("brand_name")
    .eq("id", job.user_id)
    .maybeSingle()

  let orgId = job.organization_id
  if (!orgId) {
    orgId = await getOrganizationIdAdmin(job.user_id)
  }

  /** Profile / brand tenant: must match RLS (`brand_id = auth.uid()`) for catalog visibility. */
  const tenantBrandId = job.brand_id?.trim() || job.user_id
  if (tenantBrandId !== job.brand_id) {
    await patchJob(jobId, { brand_id: tenantBrandId })
  }

  const { data: logRow, error: logErr } = await admin
    .from("product_import_logs")
    .insert({
      brand_id: tenantBrandId,
      organization_id: orgId,
      file_name: job.file_name,
      total_rows: 0,
      success_count: 0,
      failure_count: 0,
      status: "pending",
      mapping: mapping as unknown as Record<string, unknown>,
    })
    .select("id")
    .single()

  if (logErr || !logRow) {
    await patchJob(jobId, {
      status: "FAILED",
      last_error: "Could not create import log",
    })
    return
  }

  const importLogId = logRow.id as string
  await patchJob(jobId, {
    status: "PROCESSING",
    organization_id: orgId,
    product_import_log_id: importLogId,
  })

  const jobWithLog: JobRow = {
    ...job,
    brand_id: tenantBrandId,
    organization_id: orgId,
    product_import_log_id: importLogId,
  }

  const { data: existing } = await admin.from("products").select("sku").eq("brand_id", tenantBrandId)
  const existingSkus = new Set<string>()
  for (const p of existing ?? []) {
    const s = p.sku
    if (typeof s === "string" && s.trim()) existingSkus.add(s.trim().toLowerCase())
  }

  let processed = 0
  let successCount = 0
  let failureCount = 0
  let totalRows = 0

  const materialised = await materialiseImportFileToLocal(job.file_url, job.file_name)
  const absPath = materialised.localPath

  try {
    let buffer: { raw: Record<string, string>; rowNumber: number }[] = []
    const runBuffer = async () => {
      if (buffer.length === 0) return
      const chunks: (typeof buffer)[] = []
      for (let i = 0; i < buffer.length; i += CHUNK_ROWS) {
        chunks.push(buffer.slice(i, i + CHUNK_ROWS))
      }
      buffer = []

      for (let idx = 0; idx < chunks.length; idx += PARALLEL_CHUNKS) {
        const slice = chunks.slice(idx, idx + PARALLEL_CHUNKS)
        const results = await Promise.all(
          slice.map((ch) =>
            processChunk(
              jobWithLog,
              mapping,
              ch,
              profile?.brand_name ?? null,
              existingSkus,
            ),
          ),
        )
        for (const ch of slice) {
          processed += ch.length
        }
        for (const r of results) {
          successCount += r.success
          failureCount += r.failed
        }
        await patchJob(jobId, {
          processed_rows: processed,
          success_count: successCount,
          failure_count: failureCount,
        })
      }
    }

    for await (const { row, rowNumber } of iterateRowsFromFile(absPath, job.file_name)) {
      totalRows++
      buffer.push({ raw: row, rowNumber })
      if (buffer.length >= CHUNK_ROWS * PARALLEL_CHUNKS) {
        await runBuffer()
      }
    }
    await runBuffer()

    await patchJob(jobId, {
      total_rows: totalRows,
      processed_rows: processed,
      success_count: successCount,
      failure_count: failureCount,
    })

    let pipelineState: ImportPipelineState | null = null
    if (successCount > 0) {
      const initialPipeline: ImportPipelineState = {
        stage: "catalog",
        productsTotal: successCount,
        productsDone: successCount,
        passportsDone: 0,
        qrDone: 0,
        passportIds: [],
        exportRows: [],
        exportReady: false,
      }
      await persistPipelineState(admin, importLogId, mapping, initialPipeline)

      pipelineState = await runImportCatalogPipeline({
        admin,
        importLogId,
        organizationId: orgId,
        columnMapping: mapping,
        initialState: initialPipeline,
        onProgress: async (pipeline) => {
          pipelineState = pipeline
          await persistPipelineState(admin, importLogId, mapping, pipeline)
        },
      })
    }

    const finalStatus =
      successCount === 0
        ? "FAILED"
        : failureCount > 0 || (pipelineState && pipelineState.qrDone < pipelineState.passportsDone)
          ? "PARTIAL_SUCCESS"
          : "COMPLETED"

    await patchJob(jobId, { status: finalStatus })

    await admin
      .from("product_import_logs")
      .update({
        total_rows: totalRows,
        success_count: successCount,
        failure_count: failureCount,
        status:
          finalStatus === "FAILED" ? "failed" : finalStatus === "PARTIAL_SUCCESS" ? "partial" : "completed",
      })
      .eq("id", importLogId)

    await runPostImportVerification(jobWithLog)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await patchJob(jobId, {
      status: "FAILED",
      last_error: msg,
    })
    await admin
      .from("product_import_logs")
      .update({ status: "failed" })
      .eq("id", importLogId)
  } finally {
    await materialised.cleanup()
  }
}
