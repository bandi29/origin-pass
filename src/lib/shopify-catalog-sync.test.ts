import { describe, expect, it } from "vitest"
import {
  computeSyncProgressPercent,
  beginShopifySyncProgress,
  finishShopifySyncProgress,
  getShopifySyncProgressState,
  updateShopifySyncProgress,
  clearShopifySyncProgress,
} from "./shopify-catalog-sync-progress"
import {
  computeAdaptiveSyncDelayMs,
  gidToNumericId,
  parseShopifyCatalogPage,
  SYNC_PAGE_DELAY_MS,
  SYNC_PAGE_SIZE,
  SYNC_THROTTLE_HEAVY_DELAY_MS,
} from "./shopify-catalog-sync"

describe("computeSyncProgressPercent", () => {
  it("returns 0 when total is unknown", () => {
    expect(computeSyncProgressPercent(25, null)).toBe(0)
  })

  it("returns 100 for an empty catalog", () => {
    expect(computeSyncProgressPercent(0, 0)).toBe(100)
  })

  it("computes rounded percentage from processed / total", () => {
    expect(computeSyncProgressPercent(25, 100)).toBe(25)
    expect(computeSyncProgressPercent(1, 3)).toBe(33)
    expect(computeSyncProgressPercent(100, 100)).toBe(100)
  })

  it("caps at 100 when processed exceeds total", () => {
    expect(computeSyncProgressPercent(120, 100)).toBe(100)
  })
})

describe("parseShopifyCatalogPage", () => {
  it("maps GraphQL edges into bulk upsert inputs", () => {
    const products = parseShopifyCatalogPage([
      {
        node: {
          id: "gid://shopify/Product/123",
          title: "Leather Bag",
          featuredImage: { url: "https://cdn.example/bag.jpg" },
          variants: {
            edges: [
              { node: { id: "gid://shopify/ProductVariant/456", sku: "BAG-1", title: "Default", inventoryQuantity: 5 } },
            ],
          },
        },
      },
    ])

    expect(products).toEqual([
      {
        id: "123",
        title: "Leather Bag",
        imageUrl: "https://cdn.example/bag.jpg",
        sku: "BAG-1",
        inventoryCount: 5,
        variants: [{ id: "456", sku: "BAG-1", inventoryQuantity: 5 }],
      },
    ])
  })

  it("skips edges without a product id", () => {
    expect(parseShopifyCatalogPage([{ node: { title: "No id" } }])).toEqual([])
  })
})

describe("gidToNumericId", () => {
  it("extracts the trailing numeric segment from Shopify GIDs", () => {
    expect(gidToNumericId("gid://shopify/Product/9876543210")).toBe("9876543210")
  })
})

describe("shopify sync progress store", () => {
  const shop = "progress-test.myshopify.com"

  it("tracks running progress and completion", () => {
    clearShopifySyncProgress(shop)
    expect(beginShopifySyncProgress(shop)).toBe(true)
    expect(beginShopifySyncProgress(shop)).toBe(false)

    updateShopifySyncProgress(shop, { total: 100, processed: 50 })
    expect(getShopifySyncProgressState(shop)).toMatchObject({
      status: "running",
      processed: 50,
      total: 100,
      percent: 50,
    })

    finishShopifySyncProgress(shop, {
      ok: true,
      message: "Synced 100 products.",
      processed: 100,
      total: 100,
    })
    expect(getShopifySyncProgressState(shop)).toMatchObject({
      status: "done",
      percent: 100,
      ok: true,
      message: "Synced 100 products.",
    })

    clearShopifySyncProgress(shop)
  })
})

describe("computeAdaptiveSyncDelayMs", () => {
  it("uses heavy delay when leaky bucket is nearly empty", () => {
    expect(
      computeAdaptiveSyncDelayMs({ maximumAvailable: 1000, currentlyAvailable: 50, restoreRate: 50 }),
    ).toBe(SYNC_THROTTLE_HEAVY_DELAY_MS)
  })

  it("falls back to baseline when throttle telemetry is missing", () => {
    expect(computeAdaptiveSyncDelayMs(null)).toBe(SYNC_PAGE_DELAY_MS)
  })
})

describe("SYNC_PAGE_SIZE", () => {
  it("uses Shopify-recommended batch size of 50", () => {
    expect(SYNC_PAGE_SIZE).toBe(50)
  })
})
