import { beforeEach, describe, expect, it, vi } from "vitest"

const createAdminClient = vi.fn()
const getShopifyAdminToken = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))

vi.mock("@/lib/shopify-admin-token", () => ({
  getShopifyAdminToken: (...args: unknown[]) => getShopifyAdminToken(...args),
}))

import {
  buildStorefrontPassportUrl,
  dppMetaobjectHandle,
  shopifyProductGid,
  syncPassportStorefrontMetafields,
} from "./shopify-dpp-storefront-sync"

const PASSPORT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111"
const ORG_ID = "22222222-2222-4222-8222-222222222222"

describe("shopify-dpp-storefront-sync helpers (unit)", () => {
  it("builds a stable metaobject handle from the Shopify product id", () => {
    expect(dppMetaobjectHandle("10543685730591")).toBe("originpass-product-10543685730591")
    expect(dppMetaobjectHandle("  ABC 99! ")).toBe("originpass-product-abc-99-")
  })

  it("normalizes product GIDs", () => {
    expect(shopifyProductGid("123")).toBe("gid://shopify/Product/123")
    expect(shopifyProductGid("gid://shopify/Product/9")).toBe("gid://shopify/Product/9")
  })

  it("builds absolute passport URLs for metafield url type", () => {
    const prev = process.env.NEXT_PUBLIC_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = "https://origin-pass.vercel.app"
    try {
      expect(buildStorefrontPassportUrl("originpass-sandbox.myshopify.com", "42")).toBe(
        "https://origin-pass.vercel.app/sp/originpass-sandbox/42",
      )
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
      else process.env.NEXT_PUBLIC_BASE_URL = prev
    }
  })
})

describe("syncPassportStorefrontMetafields (functional)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("skips when product has no Shopify external_product_id", async () => {
    createAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: PASSPORT_ID,
                status: "active",
                passport_uid: "uid",
                product_id: PRODUCT_ID,
                product: {
                  id: PRODUCT_ID,
                  name: "Tee",
                  external_product_id: null,
                  organization_id: ORG_ID,
                },
              },
              error: null,
            }),
          }),
        }),
      }),
    })

    const result = await syncPassportStorefrontMetafields(PASSPORT_ID)
    expect(result).toEqual({ ok: true, skipped: true, reason: "not_shopify_product" })
    expect(getShopifyAdminToken).not.toHaveBeenCalled()
  })

  it("upserts metaobject + product metafields for an active Shopify-linked passport", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
      if (body.query?.includes("OriginPassUpsertDpp")) {
        return new Response(
          JSON.stringify({
            data: {
              metaobjectUpsert: {
                metaobject: { id: "gid://shopify/Metaobject/9", handle: "originpass-product-99" },
                userErrors: [],
              },
            },
          }),
          { status: 200 },
        )
      }
      if (body.query?.includes("OriginPassSetDppMetafields")) {
        return new Response(
          JSON.stringify({
            data: {
              metafieldsSet: {
                metafields: [{ id: "gid://shopify/Metafield/1", key: "passport_url" }],
                userErrors: [],
              },
            },
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ errors: [{ message: "unexpected" }] }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchMock)

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "passports") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: PASSPORT_ID,
                    status: "active",
                    passport_uid: "uid",
                    product_id: PRODUCT_ID,
                    product: {
                      id: PRODUCT_ID,
                      name: "Organic Tee",
                      external_product_id: "99",
                      organization_id: ORG_ID,
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { shop_domain: "originpass-sandbox.myshopify.com" },
                  error: null,
                }),
              }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })
    getShopifyAdminToken.mockResolvedValue("shpat_test")

    const prev = process.env.NEXT_PUBLIC_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = "https://origin-pass.vercel.app"
    try {
      const result = await syncPassportStorefrontMetafields(PASSPORT_ID)
      expect(result.ok).toBe(true)
      expect(result.metaobjectId).toBe("gid://shopify/Metaobject/9")
      expect(result.passportUrl).toBe("https://origin-pass.vercel.app/sp/originpass-sandbox/99")
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
      else process.env.NEXT_PUBLIC_BASE_URL = prev
    }
  })

  it("clears product metafields when passport is revoked", async () => {
    // Declare the (url, init) params so `mock.calls[0][1].body` is typed below.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          data: {
            metafieldsDelete: {
              deletedMetafields: [{ key: "passport_url" }, { key: "dpp" }],
              userErrors: [],
            },
          },
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "passports") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: PASSPORT_ID,
                    status: "revoked",
                    passport_uid: "uid",
                    product_id: PRODUCT_ID,
                    product: {
                      id: PRODUCT_ID,
                      name: "Tee",
                      external_product_id: "99",
                      organization_id: ORG_ID,
                    },
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { shop_domain: "originpass-sandbox.myshopify.com" },
                error: null,
              }),
            }),
          }),
        }
      },
    })
    getShopifyAdminToken.mockResolvedValue("shpat_test")

    const result = await syncPassportStorefrontMetafields(PASSPORT_ID)
    expect(result).toEqual({ ok: true, reason: "cleared" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      query?: string
    }
    expect(body.query).toContain("OriginPassDeleteDppMetafields")
  })
})
