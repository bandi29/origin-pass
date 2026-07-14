import { describe, expect, it } from "vitest"
import {
  buildVolatileProductPatch,
  SHOPIFY_SYNC_BATCH_SIZE,
} from "./shopify-sync"

describe("buildVolatileProductPatch", () => {
  it("maps Shopify title and thumbnail without touching compliance fields", () => {
    const patch = buildVolatileProductPatch({
      id: "123",
      title: "  Leather Tote  ",
      imageUrl: "https://cdn.example/tote.jpg",
      sku: "TOTE-1",
      inventoryCount: 12,
      variants: [{ id: "456", sku: "TOTE-1", inventoryQuantity: 12 }],
    })

    expect(patch).toEqual({
      name: "Leather Tote",
      image_url: "https://cdn.example/tote.jpg",
      sku: "TOTE-1",
      is_archived: false,
      metadata: { shopify: { inventory_count: 12 } },
    })
  })

  it("falls back to primary variant sku and untitled name", () => {
    const patch = buildVolatileProductPatch({
      id: "999",
      title: null,
      imageUrl: null,
      sku: null,
      inventoryCount: null,
      variants: [{ id: "1", sku: "  SKU-A  " }],
    })

    expect(patch.name).toBe("Untitled product")
    expect(patch.sku).toBe("SKU-A")
    expect(patch.metadata).toBeUndefined()
  })
})

describe("SHOPIFY_SYNC_BATCH_SIZE", () => {
  it("uses enterprise-safe batch size of 50", () => {
    expect(SHOPIFY_SYNC_BATCH_SIZE).toBe(50)
  })
})
