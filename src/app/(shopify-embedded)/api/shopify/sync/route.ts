import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimitAsync } from "@/lib/rate-limit"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { resolveEmbeddedRequestShop } from "@/lib/shopify-embedded-request-auth"
import { enqueueCatalogSync, hasCatalogSyncQueue } from "@/lib/shopify-catalog-sync-queue"
import { fetchShopifyCatalogCount } from "@/lib/shopify-catalog-sync"
import {
  HEAVY_VOLUME_THRESHOLD,
  processCatalogSyncJob,
} from "@/lib/shopify-catalog-sync-job"
import { beginSharedSyncProgress, finishSharedSyncProgress } from "@/lib/shopify-catalog-sync-progress"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Headroom for Branch A inline runs (up to ~20 cursor pages); plan-capped by Vercel.
export const maxDuration = 300

/**
 * POST /api/shopify/sync — hybrid synchronization trigger.
 *
 * Routing switch:
 *   Branch A (default): catalog < HEAVY_VOLUME_THRESHOLD, or queue infra not
 *     deployed → sync inline in this request, return 200 with the completion.
 *   Branch B: catalog ≥ threshold AND BullMQ/Redis available → enqueue and
 *     return 202 { mode: "background", status: "queued" } immediately.
 *   Safeguard: heavy catalog with NO queue → controlled Branch A variant that
 *     imports the first HEAVY_VOLUME_THRESHOLD records, then stops with a
 *     friendly infrastructure-upgrade message (no unhandled 504s).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const shop = resolveEmbeddedRequestShop(request)
  if (!shop) {
    return NextResponse.json(
      { ok: false, message: "Session expired — reopen the app and retry." },
      { status: 401 },
    )
  }

  const token = await getShopifyAdminToken(shop)
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "Store not connected. Connect the store, then try syncing again." },
      { status: 409 },
    )
  }

  // Rate limit (mirrors the server action — this HTTP surface was uncovered):
  // syncs burn the merchant's Shopify API budget.
  const rate = await checkRateLimitAsync(`shopify-sync:${shop}`, 4, 10 * 60 * 1000)
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many sync attempts — wait a few minutes and try again." },
      { status: 429 },
    )
  }

  // Cross-instance duplicate guard + seeds sync:progress:{shop} as running.
  const started = await beginSharedSyncProgress(shop, "Preparing data…")
  if (!started) {
    return NextResponse.json(
      { ok: false, message: "A catalog sync is already running for this store." },
      { status: 409 },
    )
  }

  try {
    // Dynamic discovery: exact real-time catalog volume via productsCount.
    const totalCount = await fetchShopifyCatalogCount(shop, token)
    const queueAvailable = hasCatalogSyncQueue()

    // ── Branch B: enterprise async background worker ──────────────────────────
    if (totalCount >= HEAVY_VOLUME_THRESHOLD && queueAvailable) {
      const enqueued = await enqueueCatalogSync(shop)
      if (enqueued) {
        return NextResponse.json(
          { ok: true, mode: "background", status: "queued", jobId: enqueued.jobId, totalCount },
          { status: 202 },
        )
      }
      // Queue vanished between the check and the add — fall through to inline.
    }

    // ── Branch A: serverless in-request pagination (default) ─────────────────
    // Heavy catalog without infra → capped variant; otherwise full inline run.
    const inlineCap = totalCount >= HEAVY_VOLUME_THRESHOLD ? HEAVY_VOLUME_THRESHOLD : undefined
    const outcome = await processCatalogSyncJob(shop, { inlineCap })

    return NextResponse.json(
      {
        ok: outcome.ok,
        mode: "inline",
        status: outcome.ok ? "completed" : "failed",
        message: outcome.message,
        currentCount: outcome.processed,
        totalCount: outcome.total,
        capped: outcome.capped ?? false,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error("[shopify/sync] trigger failed:", err)
    const message = "Could not start the sync. Please try again."
    // Leave a terminal progress entry so pollers don't hang on "running".
    await finishSharedSyncProgress(shop, { ok: false, message, processed: 0, total: null }).catch(() => undefined)
    return NextResponse.json({ ok: false, message }, { status: 502 })
  }
}
