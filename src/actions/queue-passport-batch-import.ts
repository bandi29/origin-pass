"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PASSPORT_MANIFEST_MAX_ROWS } from "@/lib/passport-batch-manifest"
import { enqueuePassportImportProcessing } from "@/lib/passport-batch-import-queue"
import {
  preparePassportImportRecords,
  queuePassportImportBatch,
} from "@/lib/passport-batch-import-server"
import type { PassportImportRow } from "@/lib/passport-batch-import-types"

export type QueuePassportBatchImportResult =
  | {
      success: true
      jobId: string
      message: string
      recordCount: number
      jobName: string | null
    }
  | { success: false; error: string }

export async function queuePassportBatchImportAction(input: {
  items: PassportImportRow[]
  jobName?: string | null
}): Promise<QueuePassportBatchImportResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Unauthorized" }
  }

  const items = input.items ?? []
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, error: "No valid rows found to import." }
  }

  if (items.length > PASSPORT_MANIFEST_MAX_ROWS) {
    return {
      success: false,
      error: `Batch size limit is ${PASSPORT_MANIFEST_MAX_ROWS.toLocaleString()} rows.`,
    }
  }

  for (const row of items) {
    if (!row.product_name?.trim() || !row.sku?.trim()) {
      return { success: false, error: "Each row must include product_name and sku." }
    }
  }

  const admin = createAdminClient()
  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()
  const organizationId = (userRow?.organization_id as string | null | undefined) ?? null

  const manifestBatchId = items[0]?.batch_id?.trim() || `BATCH-${Date.now()}`
  const records = preparePassportImportRecords(items, manifestBatchId)

  try {
    const { jobId, jobName } = await queuePassportImportBatch({
      userId: user.id,
      organizationId,
      manifestBatchId,
      records,
      jobName: input.jobName?.trim() || undefined,
    })

    enqueuePassportImportProcessing(jobId)

    return {
      success: true,
      jobId,
      recordCount: records.length,
      jobName,
      message: `Batch processing job successfully scheduled for ${records.length.toLocaleString()} passport${records.length === 1 ? "" : "s"}.`,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not queue batch job."
    return { success: false, error: message }
  }
}
