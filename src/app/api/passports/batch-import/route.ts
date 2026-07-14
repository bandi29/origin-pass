import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enqueuePassportImportProcessing } from "@/lib/passport-batch-import-queue"
import {
  preparePassportImportRecords,
  queuePassportImportBatch,
} from "@/lib/passport-batch-import-server"
import type { PassportImportRow } from "@/lib/passport-batch-import-types"
import { PASSPORT_MANIFEST_MAX_ROWS } from "@/lib/passport-batch-manifest"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const items: PassportImportRow[] = body.items ?? body.rows

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No valid rows found to import." }, { status: 400 })
    }

    if (items.length > PASSPORT_MANIFEST_MAX_ROWS) {
      return NextResponse.json(
        { error: `Batch size limit is ${PASSPORT_MANIFEST_MAX_ROWS} rows` },
        { status: 400 },
      )
    }

    const batchId = items[0].batch_id || `BATCH-${Date.now()}`
    const recordsToInsert = preparePassportImportRecords(items, batchId)

    const admin = createAdminClient()
    const { data: userRow } = await admin
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()
    const organizationId = (userRow?.organization_id as string | null | undefined) ?? null

    const { jobId } = await queuePassportImportBatch({
      userId: user.id,
      organizationId,
      manifestBatchId: batchId,
      records: recordsToInsert,
      jobName: body.jobName,
    })

    enqueuePassportImportProcessing(jobId)

    return NextResponse.json(
      {
        success: true,
        message: `Successfully queued background job for ${recordsToInsert.length} passports.`,
        batchId,
        jobId,
        processedCount: recordsToInsert.length,
        status: "processing",
      },
      { status: 202 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Batch Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
