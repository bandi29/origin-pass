import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { shopify_subscription_id: "gid://shopify/AppSubscription/1" } }),
        }),
      }),
    }),
  }),
}))

import { cancelAppSubscription, switchPaidPlan } from "@/lib/shopify-billing"

describe("cancelAppSubscription", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns GraphQL userErrors as error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            appSubscriptionCancel: {
              appSubscription: null,
              userErrors: [{ message: "Subscription already cancelled" }],
            },
          },
        }),
      ),
    )

    const result = await cancelAppSubscription({
      shop: "demo.myshopify.com",
      adminToken: "shpat_test",
      subscriptionId: "gid://shopify/AppSubscription/1",
    })

    expect(result).toEqual({ error: "Subscription already cancelled" })
  })

  it("returns ok + status on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: {
            appSubscriptionCancel: {
              appSubscription: { id: "gid://shopify/AppSubscription/1", status: "CANCELLED" },
              userErrors: [],
            },
          },
        }),
      ),
    )

    const result = await cancelAppSubscription({
      shop: "demo.myshopify.com",
      adminToken: "shpat_test",
      subscriptionId: "gid://shopify/AppSubscription/1",
    })

    expect(result).toEqual({ ok: true, status: "CANCELLED" })
  })

  it("rejects empty subscription id without calling Shopify", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await cancelAppSubscription({
      shop: "demo.myshopify.com",
      adminToken: "shpat_test",
      subscriptionId: "   ",
    })

    expect(result).toEqual({ error: "No active Shopify subscription to cancel." })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("switchPaidPlan", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("cancels then creates and returns confirmationUrl", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            appSubscriptionCancel: {
              appSubscription: { id: "gid://shopify/AppSubscription/1", status: "CANCELLED" },
              userErrors: [],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            appSubscriptionCreate: {
              appSubscription: { id: "gid://shopify/AppSubscription/2" },
              confirmationUrl: "https://admin.shopify.com/charges/confirm",
              userErrors: [],
            },
          },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await switchPaidPlan({
      shop: "demo.myshopify.com",
      adminToken: "shpat_test",
      plan: "scale-plan",
      returnUrl: "https://admin.shopify.com/store/demo/apps/originpass",
      currentSubscriptionId: "gid://shopify/AppSubscription/1",
    })

    expect(result).toEqual({
      confirmationUrl: "https://admin.shopify.com/charges/confirm",
      subscriptionId: "gid://shopify/AppSubscription/2",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("surfaces cancel errors and skips create", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: {
          appSubscriptionCancel: {
            appSubscription: null,
            userErrors: [{ message: "Cannot cancel" }],
          },
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await switchPaidPlan({
      shop: "demo.myshopify.com",
      adminToken: "shpat_test",
      plan: "pro-plan",
      returnUrl: "https://example.com/return",
      currentSubscriptionId: "gid://shopify/AppSubscription/1",
    })

    expect(result).toEqual({ error: "Cannot cancel" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
