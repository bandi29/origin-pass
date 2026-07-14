/**
 * QR-generation worker entry. Generates QR identities + label assets for a batch
 * and writes activation logs in chunks. Designed to be safe to retry: each item
 * is independent and the qr_batch_jobs row is updated with partial progress.
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { generateAndStorePassportQr } from "@/lib/passport-qr-server"
import type { QrGenerationJob } from "@/lib/qr-generation/queue"
import { logger, serializeError } from "@/lib/logger"

const QR_CONCURRENCY = Number(process.env.WORKER_QR_GENERATION_CONCURRENCY ?? "10") || 10
const LOG_INSERT_BATCH = 100

type BatchFailure = { productId: string; reason: string }
type BatchResult =
  | { ok: true; productId: string; logRow: Record<string, unknown> }
  | { ok: false; productId: string; reason: string }

async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = nextIndex++
      if (i >= items.length) return
      results[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return results
}

export async function executeQrGenerationBatch(job: QrGenerationJob): Promise<void> {
  const admin = createAdminClient()
  const log = (level: "info" | "warn" | "error", fields: Record<string, unknown>, msg: string) =>
    logger[level]({ scope: "qr-generation", batchJobId: job.batchJobId, ...fields }, msg)

  // Single round-trip: fetch all candidate passports, pick latest per product.
  const { data: passportRows } = await admin
    .from("passports")
    .select("id, organization_id, status, product_id, created_at")
    .in("product_id", job.productIds)
    .order("created_at", { ascending: false })

  const latestPassportByProduct = new Map<
    string,
    { id: string; organization_id: string | null; status: string }
  >()
  for (const row of (passportRows ?? []) as Array<{
    id: string
    organization_id: string | null
    status: string
    product_id: string
  }>) {
    if (!latestPassportByProduct.has(row.product_id)) {
      latestPassportByProduct.set(row.product_id, {
        id: row.id,
        organization_id: row.organization_id,
        status: row.status,
      })
    }
  }

  const results = await processWithConcurrency<string, BatchResult>(
    job.productIds,
    QR_CONCURRENCY,
    async (productId): Promise<BatchResult> => {
      const passport = latestPassportByProduct.get(productId)
      if (!passport || passport.status !== "active") {
        return { ok: false, productId, reason: "Missing active passport" }
      }
      try {
        const generated = await generateAndStorePassportQr({
          passportId: passport.id,
          organizationId: passport.organization_id ?? job.organizationId,
        })
        return {
          ok: true,
          productId,
          logRow: {
            qr_identity_id: generated.qrIdentityId ?? null,
            product_id: productId,
            organization_id: passport.organization_id ?? job.organizationId,
            actor_user_id: job.actorUserId,
            previous_status: "pending",
            next_status: "active",
            reason: "Batch generation",
            metadata: {
              jobId: job.batchJobId,
              qrCodeRowId: generated.qrCodeRowId,
            },
          },
        }
      } catch (e) {
        return {
          ok: false,
          productId,
          reason: e instanceof Error ? e.message : "Generation failed",
        }
      }
    },
  )

  let successCount = 0
  let failedCount = 0
  const failures: BatchFailure[] = []
  const logRows: Record<string, unknown>[] = []
  for (const r of results) {
    if (r.ok) {
      successCount += 1
      logRows.push(r.logRow)
    } else {
      failedCount += 1
      failures.push({ productId: r.productId, reason: r.reason })
    }
  }

  for (let i = 0; i < logRows.length; i += LOG_INSERT_BATCH) {
    const slice = logRows.slice(i, i + LOG_INSERT_BATCH)
    const { error } = await admin.from("qr_activation_logs").insert(slice)
    if (error) {
      log("warn", { errMessage: error.message, batchStart: i }, "qr_activation_logs.insert.failed")
    }
  }

  const finalStatus =
    failedCount === job.productIds.length
      ? "failed"
      : failedCount > 0
        ? "partial_success"
        : "completed"

  const { error: jobErr } = await admin
    .from("qr_batch_jobs")
    .update({
      processed_count: job.productIds.length,
      success_count: successCount,
      failed_count: failedCount,
      completed_at: new Date().toISOString(),
      status: finalStatus,
      metadata: { failures },
    })
    .eq("id", job.batchJobId)
  if (jobErr) {
    log("warn", { ...serializeError(jobErr) }, "qr_batch_jobs.update.failed")
  }

  log(
    "info",
    { successCount, failedCount, total: job.productIds.length, status: finalStatus },
    "qr.batch.complete",
  )
}
