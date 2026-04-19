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
import { mappedRowsToMergeJson } from "@/lib/import-products/build-merge-json"

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
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
    if (!json.length) return
    const headers = Object.keys(json[0]!).map((k) => k.trim()).filter(Boolean)
    let idx = 0
    for (const raw of json) {
      idx++
      const row: Record<string, string> = {}
      for (const h of headers) {
        const v = raw[h]
        if (v == null) row[h] = ""
        else if (typeof v === "number" || typeof v === "boolean") row[h] = String(v)
        else if (v instanceof Date) row[h] = v.toISOString().slice(0, 10)
        else row[h] = String(v).trim()
      }
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

  const { data: logRow, error: logErr } = await admin
    .from("product_import_logs")
    .insert({
      brand_id: job.brand_id,
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
    organization_id: orgId,
    product_import_log_id: importLogId,
  }

  const { data: existing } = await admin.from("products").select("sku").eq("brand_id", job.brand_id)
  const existingSkus = new Set<string>()
  for (const p of existing ?? []) {
    const s = p.sku
    if (typeof s === "string" && s.trim()) existingSkus.add(s.trim().toLowerCase())
  }

  let processed = 0
  let successCount = 0
  let failureCount = 0
  let totalRows = 0

  const absPath = job.file_url

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

    const finalStatus =
      successCount === 0 ? "FAILED" : failureCount > 0 ? "PARTIAL_SUCCESS" : "COMPLETED"

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
  }
}
