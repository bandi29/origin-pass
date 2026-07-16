/**
 * Shopify Billing — 3-tier subscription architecture.
 *
 * Boutique Free ($0) → Grower ($29/mo) → Enterprise ($79/mo).
 *
 * Flow (native Admin GraphQL — this stack has no @shopify/shopify-app-remix, so
 * `shopify.api.billing.request` does not exist here; `appSubscriptionCreate` is
 * its underlying API): create subscription → redirect merchant to Shopify's
 * `confirmationUrl` → on approval Shopify fires the `app_subscriptions/update`
 * webhook with status ACTIVE → we persist the tier.
 */

import { SHOPIFY_API_VERSION, isValidShopDomain } from "@/lib/shopify"
import { createServerSupabaseClient } from "@/lib/supabase"

export type SubscriptionTier = "free" | "grower" | "enterprise"

export const PAID_PLANS = {
  grower: { name: "OriginPass Grower", price: 29 },
  enterprise: { name: "OriginPass Enterprise", price: 79 },
} as const

export type PaidPlan = keyof typeof PAID_PLANS

export const TIER_LIMITS: Record<
  SubscriptionTier,
  { maxSyncedProducts: number | null; evidenceUploads: boolean; bulkOperations: boolean }
> = {
  free: { maxSyncedProducts: 15, evidenceUploads: false, bulkOperations: false },
  grower: { maxSyncedProducts: 500, evidenceUploads: true, bulkOperations: false },
  enterprise: { maxSyncedProducts: null, evidenceUploads: true, bulkOperations: true },
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "grower" || value === "enterprise"
}

export function normalizeTier(raw: unknown): SubscriptionTier {
  return raw === "grower" || raw === "enterprise" ? raw : "free"
}

/** Map a Shopify AppSubscription name back to our tier (webhook reconciliation). */
export function tierForSubscriptionName(name: string | null | undefined): SubscriptionTier {
  const normalized = (name ?? "").toLowerCase()
  if (normalized.includes("enterprise")) return "enterprise"
  if (normalized.includes("grower")) return "grower"
  return "free"
}

/** Read the store's tier by shop domain. Fails safe to "free". */
export async function getSubscriptionTier(shop: string): Promise<SubscriptionTier> {
  if (!isValidShopDomain(shop)) return "free"
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("shop_domain", shop)
      .maybeSingle()
    return normalizeTier((data as { subscription_tier?: string | null } | null)?.subscription_tier)
  } catch {
    return "free"
  }
}

/**
 * Prefer test charges unless production live billing is explicitly enabled.
 *
 * - Default / App Store review: `test: true` (no real card charge)
 * - `SHOPIFY_BILLING_LIVE=1`: live charges for production merchants
 * - `SHOPIFY_BILLING_FORCE_TEST=1`: keeps test mode even when LIVE=1
 *   (use during App Store review so $29 / $79 upgrades stay sandboxed)
 */
export function shouldUseShopifyTestBilling(): boolean {
  if (process.env.SHOPIFY_BILLING_FORCE_TEST === "1") return true
  return process.env.SHOPIFY_BILLING_LIVE !== "1"
}

/**
 * Create the recurring charge and return Shopify's confirmation URL the merchant
 * must approve. Defaults to test-mode charges; see {@link shouldUseShopifyTestBilling}.
 */
export async function createSubscriptionConfirmationUrl(input: {
  shop: string
  adminToken: string
  plan: PaidPlan
  returnUrl: string
}): Promise<{ confirmationUrl: string; subscriptionId: string } | { error: string }> {
  const { shop, adminToken, plan, returnUrl } = input
  if (!isValidShopDomain(shop) || !adminToken) return { error: "Store not connected." }

  const planDef = PAID_PLANS[plan]
  const useTestCharge = shouldUseShopifyTestBilling()
  const mutation = /* GraphQL */ `
    mutation CreateAppSubscription($name: String!, $returnUrl: URL!, $test: Boolean!, $price: Decimal!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: $price, currencyCode: USD }
                interval: EVERY_30_DAYS
              }
            }
          }
        ]
      ) {
        appSubscription { id }
        confirmationUrl
        userErrors { field message }
      }
    }
  `

  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
      body: JSON.stringify({
        query: mutation,
        variables: {
          name: planDef.name,
          returnUrl,
          test: useTestCharge,
          price: planDef.price.toFixed(2),
        },
      }),
      cache: "no-store",
    })
    if (!res.ok) return { error: "Could not reach Shopify billing." }

    const json = (await res.json()) as {
      errors?: Array<{ message?: string }>
      data?: {
        appSubscriptionCreate?: {
          appSubscription?: { id?: string } | null
          confirmationUrl?: string | null
          userErrors?: Array<{ message?: string }>
        }
      }
    }

    const result = json.data?.appSubscriptionCreate
    const userError = result?.userErrors?.[0]?.message ?? json.errors?.[0]?.message
    if (userError) return { error: userError }
    if (!result?.confirmationUrl || !result.appSubscription?.id) {
      return { error: "Shopify did not return a billing confirmation URL." }
    }
    return { confirmationUrl: result.confirmationUrl, subscriptionId: result.appSubscription.id }
  } catch (err) {
    console.error("[shopify-billing] subscription create failed:", err)
    return { error: "Billing request failed. Please try again." }
  }
}

/**
 * Apply an `app_subscriptions/update` webhook to the tenant row.
 * ACTIVE → the subscription's tier; any terminal status → back to free.
 */
export async function applySubscriptionWebhook(
  shop: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!isValidShopDomain(shop)) return
  const sub = (payload as { app_subscription?: Record<string, unknown> }).app_subscription
  if (!sub) return

  const status = typeof sub.status === "string" ? sub.status.toUpperCase() : ""
  const name = typeof sub.name === "string" ? sub.name : ""
  const gid = typeof sub.admin_graphql_api_id === "string" ? sub.admin_graphql_api_id : null

  const supabase = createServerSupabaseClient()

  if (status === "ACTIVE") {
    const tier = tierForSubscriptionName(name)
    await supabase
      .from("organizations")
      .update({ subscription_tier: tier, shopify_subscription_id: gid })
      .eq("shop_domain", shop)
    console.info(`[shopify-billing] ${shop} → ${tier} (subscription active)`)
    return
  }

  if (["CANCELLED", "EXPIRED", "DECLINED", "FROZEN"].includes(status)) {
    // Only downgrade if this webhook refers to the subscription we track (or we
    // track none) — a stale cancel for an old subscription must not clobber an
    // upgrade that was approved moments later.
    const { data } = await supabase
      .from("organizations")
      .select("shopify_subscription_id")
      .eq("shop_domain", shop)
      .maybeSingle()
    const tracked = (data as { shopify_subscription_id?: string | null } | null)?.shopify_subscription_id
    if (tracked && gid && tracked !== gid) return

    await supabase
      .from("organizations")
      .update({ subscription_tier: "free", shopify_subscription_id: null })
      .eq("shop_domain", shop)
    console.info(`[shopify-billing] ${shop} → free (subscription ${status.toLowerCase()})`)
  }
}
