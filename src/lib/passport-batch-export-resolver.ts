export type BatchJobMetadata = {
  passport_ids?: string[]
  import_passport_ids?: string[]
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

export type PassportJobRow = {
  id: string
  created_at: string | null
  metadata?: { qr_batch_job_id?: string | null } | null
}

export function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function jobTimeWindowEnd(completedAt: string | null): string | null {
  if (!completedAt) return null
  const end = new Date(completedAt)
  end.setSeconds(end.getSeconds() + 10)
  return end.toISOString()
}

/** Inclusive job ingest window with grace for import insert ordering / clock skew. */
export function passportCreatedDuringJob(
  job: BatchJobForExport,
  passport: PassportJobRow,
): boolean {
  if (!passport.created_at) return false

  const endSource = job.completed_at ?? job.started_at
  if (!endSource) return false

  const ts = new Date(passport.created_at).getTime()
  const end = new Date(jobTimeWindowEnd(endSource) ?? endSource).getTime()
  const startSource = job.started_at ?? job.completed_at
  if (!startSource) return false

  const start = new Date(startSource).getTime() - 60_000
  return ts >= start && ts <= end
}

export function jobDiscoveryQueryLimit(job: BatchJobForExport): number {
  const successCount = job.success_count ?? 0
  const inputCount = job.input_count ?? 0
  if (successCount > 0 && inputCount > 0) return Math.max(successCount, inputCount)
  if (successCount > 0) return successCount
  if (inputCount > 0) return inputCount
  return 1000
}

export function jobLabelCount(job: BatchJobForExport, metadata?: BatchJobMetadata): number {
  const queryLimit = jobDiscoveryQueryLimit(job)
  const importCount = metadata?.import_passport_ids?.length ?? 0
  const storedCount = metadata?.passport_ids?.length ?? 0

  if (queryLimit > 0) {
    return Math.max(queryLimit, importCount, storedCount)
  }
  if (importCount > 0) return importCount
  if (storedCount > 0) return storedCount
  return 1000
}

export function passportBelongsToJob(
  job: BatchJobForExport,
  passport: PassportJobRow,
): boolean {
  const linkedJobId = passport.metadata?.qr_batch_job_id
  if (linkedJobId) {
    return linkedJobId === job.id
  }

  if (!job.started_at || !job.completed_at || !passport.created_at) {
    return false
  }

  const ts = new Date(passport.created_at).getTime()
  const start = new Date(job.started_at).getTime()
  const end = new Date(jobTimeWindowEnd(job.completed_at) ?? job.completed_at).getTime()
  return ts >= start && ts <= end
}

export function isPassportLinkedToOtherJob(
  job: Pick<BatchJobForExport, "id">,
  passport: PassportJobRow,
): boolean {
  const linkedJobId = passport.metadata?.qr_batch_job_id
  return Boolean(linkedJobId && linkedJobId !== job.id)
}

export function getJobImportPassportIds(metadata: BatchJobMetadata): string[] {
  if (Array.isArray(metadata.import_passport_ids) && metadata.import_passport_ids.length > 0) {
    return metadata.import_passport_ids
  }
  if (Array.isArray(metadata.passport_ids) && metadata.passport_ids.length > 0) {
    return metadata.passport_ids
  }
  return []
}

export function filterJobLinkedPassportRows<T extends PassportJobRow>(
  job: BatchJobForExport,
  rows: T[],
  _metadata?: BatchJobMetadata,
): T[] {
  return rows.filter((row) => {
    if (isPassportLinkedToOtherJob(job, row)) return false
    if (row.metadata?.qr_batch_job_id !== job.id) return false
    return passportCreatedDuringJob(job, row)
  })
}

export function filterPassportRowsForJobExport(
  job: BatchJobForExport,
  rows: PassportJobRow[],
  metadata?: BatchJobMetadata,
  options?: { enforceImportList?: boolean },
): PassportJobRow[] {
  const enforceImportList = options?.enforceImportList ?? true
  const importIds = metadata ? getJobImportPassportIds(metadata) : []
  const importSet =
    enforceImportList && importIds.length > 0 ? new Set(importIds) : null

  return rows.filter((row) => {
    if (isPassportLinkedToOtherJob(job, row)) return false

    const linkedHere = row.metadata?.qr_batch_job_id === job.id

    if (importSet) {
      if (!importSet.has(row.id)) return false
      return passportCreatedDuringJob(job, row)
    }

    if (linkedHere) {
      return passportCreatedDuringJob(job, row)
    }

    if (!passportCreatedDuringJob(job, row)) return false
    return !row.metadata?.qr_batch_job_id
  })
}

/** Passports created during CSV ingest for this job. */
export function getCanonicalImportPassportIds(
  metadata: BatchJobMetadata,
  job: BatchJobForExport,
): string[] {
  const successCount = job.success_count ?? 0

  if (Array.isArray(metadata.import_passport_ids) && metadata.import_passport_ids.length > 0) {
    if (successCount === 0 || metadata.import_passport_ids.length >= successCount) {
      return metadata.import_passport_ids
    }
  }

  const stored = Array.isArray(metadata.passport_ids) ? metadata.passport_ids : []

  if (stored.length > 0 && !metadata.labels_exported_at) {
    return stored
  }

  if (stored.length > 0 && successCount > 0 && stored.length >= successCount) {
    return stored.slice(0, successCount)
  }

  return []
}

export function pickPassportIdsForJob(params: {
  job: BatchJobForExport
  targetCount: number
  byJobLink: string[]
  canonicalImportIds: string[]
  verifiedCanonicalIds: string[]
  byJobWindow: string[]
}): string[] {
  const { job, targetCount, byJobLink, canonicalImportIds, verifiedCanonicalIds, byJobWindow } =
    params

  if (byJobLink.length > 0) {
    return byJobLink.slice(0, targetCount)
  }

  if (verifiedCanonicalIds.length > 0) {
    return verifiedCanonicalIds.slice(0, targetCount)
  }

  if (byJobWindow.length > 0) {
    return byJobWindow.slice(0, targetCount)
  }

  if (canonicalImportIds.length > 0) {
    return canonicalImportIds.slice(0, targetCount)
  }

  return []
}

export function finalizeResolvedPassportIds(params: {
  collected: string[]
  canonicalImportIds: string[]
  targetCount: number
  jobWindowIds?: string[]
}): string[] {
  const { collected, canonicalImportIds, targetCount, jobWindowIds } = params

  if (canonicalImportIds.length > 0) {
    const target = Math.max(targetCount, canonicalImportIds.length)
    const merged = dedupePreserveOrder([...canonicalImportIds, ...collected])
    let resolved = merged

    if (jobWindowIds && merged.length > target) {
      const windowSet = new Set(jobWindowIds)
      const inWindow = merged.filter((id) => windowSet.has(id))
      if (inWindow.length >= canonicalImportIds.length) {
        resolved = inWindow
      }
    }

    if (resolved.length > target) {
      resolved = resolved.slice(0, target)
    }

    if (resolved.length < canonicalImportIds.length) {
      return canonicalImportIds.slice(0, target)
    }

    return resolved
  }

  let resolved = collected
  if (jobWindowIds && collected.length > targetCount) {
    const windowSet = new Set(jobWindowIds)
    const inWindow = collected.filter((id) => windowSet.has(id))
    if (inWindow.length > 0) resolved = inWindow
  }

  if (resolved.length > targetCount) {
    resolved = resolved.slice(0, targetCount)
  }

  return resolved
}

export function buildBatchExportFolderName(
  job: Pick<BatchJobForExport, "id" | "job_name">,
  metadata?: BatchJobMetadata,
): string {
  if (metadata?.export_folder_name?.trim()) {
    return metadata.export_folder_name.trim()
  }
  if (job.job_name?.trim()) {
    return job.job_name.trim()
  }
  return `batch-${job.id.slice(0, 8)}`
}
