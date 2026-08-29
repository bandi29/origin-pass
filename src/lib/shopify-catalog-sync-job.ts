/**
 * The heavy Shopify catalog sync engine — runs inside the persistent BullMQ
 * worker (or inline in dev when REDIS_URL is unset). Serverless routes/actions
 * must never call the network/DB loops in here directly; they only enqueue.
 *
 * SECURITY NOTE: the job payload deliberately carries only { shopDomain, context }.
 * The merchant's offline access token is re-read from Supabase here, NOT placed in
 * the Redis job payload — tokens at rest in a queue broker are a leak surface, and
 * re-reading also survives token rotation between enqueue and execution.
 */

import { createServerSupabaseClient } from "@/lib/supabase"
import {
  fetchShopifyCatalogCount,
  fetchShopifyCatalogPage,
  syncPageDelay,
} from "@/lib/shopify-catalog-sync"
import {
  beginSharedSyncProgress,
  finishSharedSyncProgress,
  updateSharedSyncProgress,
} from "@/lib/shopify-catalog-sync-progress"
import {
  ShopifyBulkError,
  downloadAndParseBulkProducts,
  pollBulkOperation,
  startBulkProductExport,
} from "@/lib/shopify-bulk-operations"
import {
  archiveDelistedShopifyProducts,
  bulkUpsertShopifyProducts,
  type BulkProductInput,
} from "@/lib/shopify-sync"
import {
  PLAN_LIMITS,
  TIER_LIMITS,
  countPassportsForOrganization,
  normalizeTier,
  upgradePassportLimitMessage,
} from "@/lib/shopify-billing"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"

/** Catalogs at or above this size skip cursor pagination for a Bulk Operation. */
export const BULK_OPERATION_THRESHOLD = 2_000
/**
 * Routing scale for the hybrid engine: below this, syncs run inline in the
 * serverless request; at/above it they belong on the background worker.
 */
export const HEAVY_VOLUME_THRESHOLD = 2_000
/** Strict cursor page size for the small-catalog path. */
const CURSOR_PAGE_SIZE = 100
/** DB commit batch block size for the bulk-operations ingest. */
const DB_UPSERT_CHUNK = 100
/** How many 100-row batches to commit concurrently (bounds the connection pool). */
const UPSERT_CONCURRENCY = 4

export type CatalogSyncJobPayload = {
  shopDomain: string
  /** Operation context marker (extensible: e.g. "full-catalog" | "delta"). */
  context: "full-catalog"
}

export type CatalogSyncJobOptions = {
  /**
   * Inline-serverless safety cap: forces the cursor path (a lambda cannot sit
   * through a Bulk Operation) and stops after this many products. Used when a
   * heavy catalog is synced without the queue infrastructure deployed.
   */
  inlineCap?: number
}

export type CatalogSyncOutcome = {
  ok: boolean
  message: string
  processed: number
  total: number | null
  /** True when an inlineCap stopped the run before the full catalog was seen. */
  capped?: boolean
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Progress copy — "Syncing item 4,500 of 17,000…" with grouped thousands. */
function syncingMessage(processed: number, total: number | null): string {
  const denom = (total ?? processed).toLocaleString()
  return `Syncing item ${processed.toLocaleString()} of ${denom}…`
}

/**
 * Execute one full catalog sync for `shop`. Progress is continuously published to
 * Redis (`sync:progress:{shop}`) so the serverless status endpoint stays live.
 * Assumes the caller (queue/worker) has already passed the duplicate-run guard;
 * re-seeds the progress entry itself so a worker restart still reports correctly.
 */
export async function processCatalogSyncJob(
  shop: string,
  options: CatalogSyncJobOptions = {},
): Promise<CatalogSyncOutcome> {
  const inlineCap = options.inlineCap
  // (Re)seed running state from this process — begin is tolerant of the enqueue
  // instance having already marked the run as queued.
  await beginSharedSyncProgress(shop, "Preparing data…").catch(() => true)

  const supabase = createServerSupabaseClient()
  const { data: store } = await supabase
    .from("organizations")
    .select("id, subscription_tier")
    .eq("shop_domain", shop)
    .maybeSingle()

  const storeRow = store as {
    id?: string
    subscription_tier?: string | null
  } | null
  const orgId = storeRow?.id
  // Auto-refreshing expiring offline token — never read the column directly.
  const token = orgId ? await getShopifyAdminToken(shop) : null
  if (!token || !orgId) {
    const message =
      "Store not connected. Click “Connect store” above to authorize OriginPass, then try syncing again."
    await finishSharedSyncProgress(shop, { ok: false, message, processed: 0, total: null })
    return { ok: false, message, processed: 0, total: null }
  }

  // ── Tier gating (passport count, not product rows) ──────────────────────────
  const tier = normalizeTier(storeRow?.subscription_tier)
  const tierLimit = PLAN_LIMITS[tier].maxPassports
  const passportCount = await countPassportsForOrganization(orgId)

  // At the passport ceiling, block the sync with an upgrade prompt.
  if (tierLimit != null && passportCount >= tierLimit) {
    const message = upgradePassportLimitMessage(passportCount, tier)
    await finishSharedSyncProgress(shop, { ok: false, message, processed: 0, total: null })
    return { ok: false, message, processed: 0, total: null }
  }

  let synced = 0
  let failed = 0
  let archived = 0
  let totalProducts: number | null = null
  /** False when a cap made us stop early — delisted-archival must skip. */
  let sawFullCatalog = true
  const activeExternalProductIds = new Set<string>()

  const noteActive = (products: BulkProductInput[]) => {
    for (const product of products) {
      if (product.id) activeExternalProductIds.add(product.id)
    }
  }

  // Effective per-run import ceiling: serverless inline cap and remaining
  // passport slots (Scale has no plan ceiling). Approximate 1 product ≈ slots
  // for progress stopping; hard stop still uses live passport counts below.
  const remainingSlots =
    tierLimit == null ? Number.POSITIVE_INFINITY : Math.max(0, tierLimit - passportCount)
  const effectiveCap =
    remainingSlots === Number.POSITIVE_INFINITY
      ? inlineCap
      : Math.min(inlineCap ?? Number.POSITIVE_INFINITY, remainingSlots)

  try {
    // 1. Total count discovery (productsCount) — the progress denominator.
    totalProducts = await fetchShopifyCatalogCount(shop, token)
    await updateSharedSyncProgress(shop, { total: totalProducts, processed: 0, message: "Preparing data…" })

    // The Bulk Operations path is Scale-only AND worker-only: lower tiers use
    // standard GraphQL cursor paging, and a serverless inline run (inlineCap set)
    // cannot sit through an async export regardless of tier.
    if (
      inlineCap == null &&
      TIER_LIMITS[tier].bulkOperations &&
      (totalProducts ?? 0) >= BULK_OPERATION_THRESHOLD
    ) {
      // 2a. Large catalog → Shopify Bulk Operations (async export, no page loop).
      await startBulkProductExport(shop, token)
      const { url } = await pollBulkOperation(shop, token, {
        onPoll: () => void updateSharedSyncProgress(shop, { message: "Preparing data…" }),
      })

      if (url) {
        const catalog = await downloadAndParseBulkProducts(url)
        noteActive(catalog)

        // Commit in tightly-grouped 100-row blocks, a few waves concurrently.
        const chunks = chunkArray(catalog, DB_UPSERT_CHUNK)
        for (let i = 0; i < chunks.length; i += UPSERT_CONCURRENCY) {
          const wave = chunks.slice(i, i + UPSERT_CONCURRENCY)
          const results = await Promise.all(wave.map((block) => bulkUpsertShopifyProducts(shop, block)))
          results.forEach((result, idx) => {
            if (result.ok) synced += result.synced
            else failed += wave[idx].length
          })
          await updateSharedSyncProgress(shop, {
            processed: synced + failed,
            total: totalProducts,
            message: syncingMessage(synced + failed, totalProducts),
          })
        }
      }
    } else {
      // 2b. Small catalog → cursor pagination in strict pages of 100.
      let cursor: string | null = null
      let hasNextPage = true
      while (hasNextPage) {
        const page = await fetchShopifyCatalogPage(shop, token, cursor, CURSOR_PAGE_SIZE)
        noteActive(page.products)

        const result = await bulkUpsertShopifyProducts(shop, page.products)
        if (result.ok) synced += result.synced
        else failed += page.products.length

        await updateSharedSyncProgress(shop, {
          processed: synced + failed,
          total: totalProducts,
          message: syncingMessage(synced + failed, totalProducts),
        })

        hasNextPage = page.hasNextPage
        cursor = page.endCursor

        // Stop at the effective ceiling (serverless time budget and/or plan limit).
        if (effectiveCap != null && synced + failed >= effectiveCap && hasNextPage) {
          sawFullCatalog = false
          break
        }

        if (hasNextPage) await syncPageDelay(page.suggestedDelayMs)
      }
    }

    // Freshness stamp: any run that committed rows counts as a sync (capped too).
    if (synced > 0) {
      await supabase
        .from("organizations")
        .update({ shopify_last_synced_at: new Date().toISOString() })
        .eq("id", orgId)
    }

    // 3. Finalize. Delisted-archival compares the FULL live catalog against our
    // rows — running it after a capped partial pass would archive every product
    // beyond the cap, so it only runs when the whole catalog was seen.
    if (sawFullCatalog) {
      await updateSharedSyncProgress(shop, { message: "Finalizing cleanups…" })
      const delistResult = await archiveDelistedShopifyProducts(orgId, activeExternalProductIds)
      if (delistResult.ok) archived = delistResult.archived
    }
  } catch (err) {
    const message =
      err instanceof ShopifyBulkError
        ? err.message
        : err instanceof Error && err.message.includes("429")
          ? "Shopify rate limit reached — wait a moment and try again."
          : err instanceof Error && err.message.includes("GraphQL")
            ? "Shopify rejected the catalog request. Try reconnecting the store."
            : "Sync failed. Check your connection and try again."
    console.error("[catalog-sync-job] failed:", err)
    const outcome = { ok: false, message, processed: synced + failed, total: totalProducts }
    // finally-style guarantee: always leave a terminal progress entry behind.
    await finishSharedSyncProgress(shop, outcome).catch(() => undefined)
    return outcome
  }

  if (!sawFullCatalog) {
    // Stopped at a ceiling. Say which one honestly: the plan limit gets an
    // upgrade prompt; the pure infrastructure cap gets the ops message.
    const processedCount = synced + failed
    const totalLabel = totalProducts != null ? totalProducts.toLocaleString() : "all"
    const hitPlanLimit = tierLimit != null && processedCount >= remainingSlots
    const message = hitPlanLimit
      ? tier === "free"
        ? `Stopped at the Starter Free limit of ${tierLimit} passports. Upgrade to Pro ($29/mo) for up to 250 items, or Scale ($79/mo) for unlimited.`
        : `Stopped at the Pro plan limit of ${tierLimit} passports. Upgrade to Scale ($79/mo) for unlimited passports and high-volume Bulk API syncs.`
      : `Synced the first ${processedCount.toLocaleString()} of ${totalLabel} products. Catalogs this large need the background sync infrastructure — deploy the sync worker (Redis + worker service) to import everything.`
    const outcome = { ok: false, message, processed: processedCount, total: totalProducts, capped: true }
    await finishSharedSyncProgress(shop, outcome)
    return outcome
  }

  if (synced === 0 && failed > 0) {
    const message = "Found products in Shopify but could not save them. Contact support if this persists."
    const outcome = { ok: false, message, processed: failed, total: totalProducts }
    await finishSharedSyncProgress(shop, outcome)
    return outcome
  }

  if (synced === 0) {
    const message = "No products found in your Shopify catalog yet."
    const outcome = { ok: true, message, processed: 0, total: 0 }
    await finishSharedSyncProgress(shop, outcome)
    return outcome
  }

  const archiveSuffix = archived > 0 ? ` Archived ${archived} delisted product${archived === 1 ? "" : "s"}.` : ""
  const message = `Synced ${synced} product${synced === 1 ? "" : "s"} from your store.${archiveSuffix}`
  const outcome = { ok: true, message, processed: synced, total: totalProducts }
  await finishSharedSyncProgress(shop, outcome)
  return outcome
}
