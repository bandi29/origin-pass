import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { enqueueQrGeneration } from "@/lib/qr-generation/queue"
import {
  deriveUserScope,
  getCachedIdempotentResponse,
  readIdempotencyKey,
  storeIdempotentResponse,
} from "@/lib/idempotency"

/**
 * POST /api/qr/batch-generate
 *
 * Returns IMMEDIATELY with a job id. The actual QR generation and Storage uploads
 * happen in the qr-generation BullMQ worker. The UI should poll `qr_batch_jobs`
 * (or subscribe via Supabase realtime) for status / progress.
 *
 * Old behavior was inline: up to 1000 products × ~1 sec each = guaranteed timeout
 * on serverless. New behavior: ~50 ms response.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const idempotencyKey = readIdempotencyKey(request)
  const idempotencyScope = deriveUserScope(user.id)
  if (idempotencyKey) {
    const cached = await getCachedIdempotentResponse(idempotencyScope, idempotencyKey)
    if (cached) return cached
  }

  const body = (await request.json().catch(() => null)) as {
    productIds?: string[]
    jobName?: string
  } | null
  const productIds = body?.productIds ?? []
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return Response.json({ error: "productIds[] is required" }, { status: 400 })
  }
  if (productIds.length > 1000) {
    return Response.json({ error: "Batch size limit is 1000 products" }, { status: 400 })
  }

  // Scope the requested products to what the caller is allowed to act on. (See
  // architecture-review #16 for the eventual single-query org-scoped replacement.)
  const scoped = await getScopedProductIds(user.id)
  const scopedSet = new Set(scoped)
  const allowedIds = productIds.filter((id) => scopedSet.has(id))
  if (!allowedIds.length) return Response.json({ error: "No permitted products in batch" }, { status: 403 })

  const admin = createAdminClient()
  const { data: userRow } = await admin
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()
  const organizationId = (userRow?.organization_id as string | null) ?? null

  // Create the batch job row in "queued" state — the worker transitions it to
  // "processing" → "completed" / "partial_success" / "failed".
  const { data: job, error: jobError } = await admin
    .from("qr_batch_jobs")
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      job_name: body?.jobName ?? `Batch QR ${new Date().toISOString().slice(0, 10)}`,
      input_count: allowedIds.length,
      status: "queued",
    })
    .select("id")
    .single()

  if (jobError || !job?.id) {
    return Response.json(
      { error: "Could not create batch job. Ensure qr_batch_jobs migration is applied." },
      { status: 500 },
    )
  }

  try {
    await enqueueQrGeneration({
      batchJobId: job.id as string,
      organizationId,
      actorUserId: user.id,
      productIds: allowedIds,
    })
  } catch (err) {
    // Mark the job failed so the user can retry.
    await admin
      .from("qr_batch_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata: { enqueueError: err instanceof Error ? err.message : String(err) },
      })
      .eq("id", job.id as string)
    return Response.json({ error: "Could not enqueue batch job. Try again." }, { status: 503 })
  }

  const responseBody = {
    jobId: job.id,
    status: "queued" as const,
    inputCount: allowedIds.length,
  }
  if (idempotencyKey) {
    await storeIdempotentResponse(idempotencyScope, idempotencyKey, {
      status: 202,
      body: responseBody,
    })
  }
  return Response.json(responseBody, { status: 202 })
}
