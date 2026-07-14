import { NextResponse, type NextRequest } from "next/server"
import { resolveEmbeddedRequestShop } from "@/lib/shopify-embedded-request-auth"
import {
  readSharedSyncProgress,
  type ShopifySyncProgressStatus,
} from "@/lib/shopify-catalog-sync-progress"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Public status vocabulary for the polling client. */
type PublicSyncStatus = "idle" | "processing" | "completed" | "failed"

const STATUS_MAP: Record<ShopifySyncProgressStatus, PublicSyncStatus> = {
  idle: "idle",
  running: "processing",
  done: "completed",
  error: "failed",
}

/**
 * GET /api/shopify/sync/status — live sync metrics for the polling UI.
 *
 * Reads exclusively from Redis (`sync:progress:{shopDomain}`) via the shared
 * progress layer — never `globalThis`/instance memory — so any Vercel instance
 * answers consistently regardless of which instance enqueued or which worker
 * is executing. (The in-process fallback only engages in dev without REDIS_URL,
 * where enqueue/execute/poll are all the same process.)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const shop = resolveEmbeddedRequestShop(request)
  if (!shop) {
    return NextResponse.json({ ok: false, message: "Session expired." }, { status: 401 })
  }

  const progress = await readSharedSyncProgress(shop)
  return NextResponse.json({
    ok: true,
    status: STATUS_MAP[progress.status],
    currentCount: progress.processed,
    totalCount: progress.total,
    percentage: progress.percent,
    message: progress.message,
    updatedAt: progress.updatedAt,
  })
}
