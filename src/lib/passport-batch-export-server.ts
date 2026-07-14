import QRCode from "qrcode"
import JSZip from "jszip"
import { createAdminClient } from "@/lib/supabase/admin"
import { sanitizeForFilename } from "@/lib/security"
import {
  buildBatchExportFolderName,
  dedupePreserveOrder,
  filterJobLinkedPassportRows,
  filterPassportRowsForJobExport,
  getJobImportPassportIds,
  isPassportLinkedToOtherJob,
  jobDiscoveryQueryLimit,
  jobLabelCount,
  jobTimeWindowEnd,
  passportBelongsToJob,
  passportCreatedDuringJob,
} from "@/lib/passport-batch-export-resolver"

type PassportMeta = { id: string; serial_number: string | null; created_at?: string | null }

type AdminClient = ReturnType<typeof createAdminClient>

export type BatchJobMetadata = {
  passport_ids?: string[]
  import_passport_ids?: string[]
  exported_passport_ids?: string[]
  export_folder_name?: string | null
  labels_exported_at?: string | null
  assets_generated_at?: string | null
  source?: string
  manifest_batch_id?: string | null
}

export type BatchJobForExport = {
  id: string
  job_name?: string | null
  organization_id: string | null
  created_by: string | null
  started_at: string | null
  completed_at: string | null
  input_count: number | null
  success_count: number | null
}

export {
  buildBatchExportFolderName,
  dedupePreserveOrder,
  filterJobLinkedPassportRows,
  filterPassportRowsForJobExport,
  getJobImportPassportIds,
  isPassportLinkedToOtherJob,
  jobDiscoveryQueryLimit,
  jobLabelCount,
  jobTimeWindowEnd,
  passportBelongsToJob,
  passportCreatedDuringJob,
} from "@/lib/passport-batch-export-resolver"

type PassportRow = {
  id: string
  created_at: string | null
  product_id?: string | null
  metadata?: { qr_batch_job_id?: string | null } | null
}

async function loadPassportRowsForIds(
  admin: AdminClient,
  passportIds: string[],
): Promise<PassportRow[]> {
  if (passportIds.length === 0) return []

  const { data } = await admin
    .from("passports")
    .select("id, created_at, product_id, metadata")
    .in("id", passportIds)

  return (data ?? []) as PassportRow[]
}

async function loadBrandProductIds(admin: AdminClient, job: BatchJobForExport): Promise<string[]> {
  if (!job.created_by) return []

  let productQuery = admin.from("products").select("id").eq("brand_id", job.created_by)
  if (job.organization_id) {
    productQuery = productQuery.eq("organization_id", job.organization_id)
  }

  const { data: products } = await productQuery
  let ids = (products ?? []).map((product) => product.id as string)

  if (ids.length === 0 && job.organization_id) {
    const { data: fallbackProducts } = await admin
      .from("products")
      .select("id")
      .eq("brand_id", job.created_by)
    ids = (fallbackProducts ?? []).map((product) => product.id as string)
  }

  return ids
}

function sortPassportRowsByCreatedAt(rows: PassportRow[]): PassportRow[] {
  return [...rows].sort(
    (a, b) =>
      new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime(),
  )
}

function rowsToIds(rows: PassportRow[], limit: number): string[] {
  const sorted = sortPassportRowsByCreatedAt(rows)
  return sorted.slice(0, limit > 0 ? limit : sorted.length).map((row) => row.id)
}

async function linkPassportsToJob(
  admin: AdminClient,
  job: BatchJobForExport,
  rows: PassportRow[],
  metadata: BatchJobMetadata,
): Promise<void> {
  const eligible = filterPassportRowsForJobExport(job, rows, metadata, { enforceImportList: false })
  for (const row of eligible) {
    if (row.metadata?.qr_batch_job_id === job.id) continue
    if (isPassportLinkedToOtherJob(job, row)) continue

    const nextMetadata = { ...(row.metadata ?? {}), qr_batch_job_id: job.id }
    await admin.from("passports").update({ metadata: nextMetadata }).eq("id", row.id)
  }
}

async function queryPassportRowsByJobLink(
  admin: AdminClient,
  job: BatchJobForExport,
  metadata: BatchJobMetadata,
): Promise<PassportRow[]> {
  const { data } = await admin
    .from("passports")
    .select("id, created_at, product_id, metadata")
    .filter("metadata->>qr_batch_job_id", "eq", job.id)
    .order("created_at", { ascending: true })
    .limit(jobDiscoveryQueryLimit(job))

  return filterJobLinkedPassportRows(job, (data ?? []) as PassportRow[], metadata)
}

async function queryPassportRowsFromImportList(
  admin: AdminClient,
  job: BatchJobForExport,
  metadata: BatchJobMetadata,
): Promise<PassportRow[]> {
  const importIds = getJobImportPassportIds(metadata)
  if (importIds.length === 0) return []

  const rows = await loadPassportRowsForIds(admin, importIds)
  return filterPassportRowsForJobExport(job, rows, metadata, { enforceImportList: true })
}

async function queryPassportRowsInJobWindow(
  admin: AdminClient,
  job: BatchJobForExport,
): Promise<PassportRow[]> {
  const since = job.started_at
    ? new Date(new Date(job.started_at).getTime() - 60_000).toISOString()
    : job.completed_at
  const until = jobTimeWindowEnd(job.completed_at)
  if (!since || !job.created_by) return []

  const productIds = await loadBrandProductIds(admin, job)
  if (productIds.length === 0) return []

  let query = admin
    .from("passports")
    .select("id, created_at, product_id, metadata")
    .in("product_id", productIds)
    .gte("created_at", since)

  if (until) {
    query = query.lte("created_at", until)
  }

  const { data } = await query
    .order("created_at", { ascending: true })
    .limit(jobDiscoveryQueryLimit(job))

  const rows = (data ?? []) as PassportRow[]
  return rows.filter((row) => {
    if (isPassportLinkedToOtherJob(job, row)) return false
    return passportCreatedDuringJob(job, row)
  })
}

export async function resolvePassportIdsForJob(
  admin: AdminClient,
  job: BatchJobForExport,
  metadata: BatchJobMetadata,
): Promise<string[]> {
  const targetCount = jobLabelCount(job, metadata)

  const byJobLink = await queryPassportRowsByJobLink(admin, job, metadata)
  if (byJobLink.length > 0) {
    return rowsToIds(byJobLink, targetCount)
  }

  const fromImportList = await queryPassportRowsFromImportList(admin, job, metadata)
  if (fromImportList.length > 0) {
    const ids = rowsToIds(fromImportList, targetCount)
    await linkPassportsToJob(admin, job, fromImportList, metadata)
    return ids
  }

  const fromWindow = await queryPassportRowsInJobWindow(admin, job)
  if (fromWindow.length > 0) {
    const ids = rowsToIds(fromWindow, targetCount)
    await linkPassportsToJob(admin, job, fromWindow, metadata)
    return ids
  }

  return []
}

export async function buildPassportLabelsZip(
  batchId: string,
  passports: PassportMeta[],
  options?: { folderName?: string },
): Promise<{ zipBuffer: Uint8Array; filename: string; fileCount: number }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const zip = new JSZip()
  const usedNames = new Set<string>()
  let fileCount = 0
  const folder = sanitizeForFilename(options?.folderName ?? `batch-${batchId.slice(0, 8)}`)

  for (const passport of passports) {
    const url = `${baseUrl}/scan/${passport.id}`
    const pngBuffer = await QRCode.toBuffer(url, { type: "png", width: 512, margin: 2 })
    let label = sanitizeForFilename(passport.serial_number ?? passport.id.slice(0, 8))
    if (usedNames.has(label)) {
      label = `${label}-${passport.id.slice(0, 8)}`
    }
    usedNames.add(label)
    zip.file(`${folder}/${label}.png`, pngBuffer)
    fileCount += 1
  }

  const zipBuffer = await zip.generateAsync({ type: "uint8array" })
  return {
    zipBuffer,
    filename: `originpass-labels-${batchId}.zip`,
    fileCount,
  }
}

export function batchHasPreGeneratedAssets(metadata: BatchJobMetadata): boolean {
  return Boolean(metadata.assets_generated_at)
}

export async function loadPassportsForExport(
  admin: AdminClient,
  passportIds: string[],
): Promise<PassportMeta[] | null> {
  if (passportIds.length === 0) return null

  const { data: passports, error } = await admin
    .from("passports")
    .select("id, serial_number, created_at")
    .in("id", passportIds)

  if (error || !passports?.length) return null

  const order = new Map(passportIds.map((id, index) => [id, index]))
  const sorted = [...passports].sort(
    (a, b) => (order.get(a.id as string) ?? 0) - (order.get(b.id as string) ?? 0),
  )

  return sorted as PassportMeta[]
}

export async function persistBatchExportMetadata(
  admin: AdminClient,
  batchId: string,
  metadata: BatchJobMetadata,
  passportIds: string[],
  job?: BatchJobForExport,
) {
  const exportedAt = new Date().toISOString()
  const exportFolderName =
    metadata.export_folder_name ??
    (job ? buildBatchExportFolderName(job, metadata) : null)
  const exportedIds = dedupePreserveOrder(passportIds)

  await admin
    .from("qr_batch_jobs")
    .update({
      metadata: {
        ...metadata,
        export_folder_name: exportFolderName,
        import_passport_ids: metadata.import_passport_ids ?? exportedIds,
        passport_ids: exportedIds,
        exported_passport_ids: exportedIds,
        assets_generated_at: metadata.assets_generated_at ?? exportedAt,
        labels_exported_at: exportedAt,
      },
    })
    .eq("id", batchId)
}

export async function assertBatchJobExportAccess(
  admin: AdminClient,
  userId: string,
  job: BatchJobForExport,
): Promise<boolean> {
  if (job.created_by === userId) return true

  if (!job.organization_id) return false

  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle()

  return userRow?.organization_id === job.organization_id
}

export function formatExportSerialHeader(passports: PassportMeta[]): string {
  return passports
    .map((passport) => passport.serial_number ?? passport.id.slice(0, 8))
    .join(", ")
}
