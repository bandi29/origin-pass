export const EXPORTED_BATCHES_STORAGE_KEY = "originpass-exported-batch-labels"

export type BatchHistoryStatus = "completed" | "queued" | "processing" | "failed"

export type BatchExportTrackingRow = {
  id: string
  status: BatchHistoryStatus
  recordCount: number
  inputCount?: number
  successCount?: number
  hasBeenExported?: boolean
  assetsGenerated?: boolean
}

/** Shared emerald meta badge styling for batch lifecycle chips. */
export const BATCH_META_BADGE_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide"

export const BATCH_COMPLETED_STATUS_BADGE = `${BATCH_META_BADGE_BASE} border-emerald-200 bg-emerald-100 text-emerald-800`

export const BATCH_ASSETS_GENERATED_BADGE = `${BATCH_META_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-700`

export const BATCH_DOWNLOADED_INDICATOR =
  "inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-emerald-600"

export function readExportedBatchIdsFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(EXPORTED_BATCHES_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === "string"))
  } catch {
    return new Set()
  }
}

export function persistExportedBatchIds(ids: Set<string>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(EXPORTED_BATCHES_STORAGE_KEY, JSON.stringify([...ids]))
}

export function mergeExportedBatchIds(
  persisted: Set<string>,
  jobs: BatchExportTrackingRow[],
): Set<string> {
  const next = new Set(persisted)
  for (const job of jobs) {
    if (job.hasBeenExported) next.add(job.id)
  }
  return next
}

/** Completed jobs with passport rows ready for ZIP export. */
export function jobHasGeneratedAssets(job: BatchExportTrackingRow): boolean {
  if (job.status !== "completed") return false
  if (job.assetsGenerated) return true
  const count = job.successCount ?? job.recordCount ?? 0
  return count > 0
}

export function jobHasBeenDownloaded(
  job: BatchExportTrackingRow,
  exportedBatchIds: Set<string>,
): boolean {
  return Boolean(job.hasBeenExported) || exportedBatchIds.has(job.id)
}

export function batchExportActionLabel(downloaded: boolean, exporting: boolean): string {
  if (exporting) return "Generating & Zipping..."
  return downloaded ? "Re-export ZIP" : "Export ZIP"
}

export function batchTopExportActionLabel(downloaded: boolean, exporting: boolean): string {
  if (exporting) return "Generating & Zipping..."
  return downloaded ? "Re-export ZIP labels" : "Export ZIP labels"
}
