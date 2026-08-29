/**
 * Shopify Billing — 3-tier subscription architecture.
 *
 * Starter Free ($0) → Pro (`pro-plan`, $29/mo) → Scale (`scale-plan`, $79/mo).
 *
 * Active plan is stored on `organizations.subscription_tier` as the Shopify plan
 * handle (`free` | `pro-plan` | `scale-plan`). GraphQL `appSubscriptionCreate`
 * uses display names; webhooks map those names (and legacy Grower/Enterprise)
 * back to handles via {@link tierForSubscriptionName}.
 *
 * Flow: create subscription → merchant approves `confirmationUrl` →
 * `app_subscriptions/update` webhook persists the tier. Cancel / switch uses
 * `appSubscriptionCancel` then (for switch) a new charge.
 *
 * Shopify Admin merchants must use this module only — never Paddle
 * (`src/lib/paddle.ts` is web-portal billing).
 */

import { SHOPIFY_API_VERSION, isValidShopDomain } from "@/lib/shopify"
import { createServerSupabaseClient } from "@/lib/supabase"

/** Shopify / Partner plan handles. */
export type PlanHandle = "free" | "pro-plan" | "scale-plan"

/** @deprecated Prefer {@link PlanHandle} — kept as an alias for existing call sites. */
export type SubscriptionTier = PlanHandle

export const PAID_PLANS = {
  "pro-plan": { name: "OriginPass Pro", handle: "pro-plan" as const, price: 29 },
  "scale-plan": { name: "OriginPass Scale", handle: "scale-plan" as const, price: 79 },
} as const

export type PaidPlan = keyof typeof PAID_PLANS

/**
 * Entitlements keyed by active subscription handle.
 * `maxPassports: null` means unlimited.
 */
export const PLAN_LIMITS: Record<
  PlanHandle,
  {
    maxPassports: number | null
    allowTranslations: boolean
    allowPdfUploads: boolean
    allowLabelExports: boolean
    allowBadgeCustomization: boolean
    allowBulkCsv: boolean
    /** Shopify Admin Bulk Operations API for very large catalog syncs. */
    bulkOperations: boolean
  }
> = {
  free: {
    maxPassports: 10,
    allowTranslations: false,
    allowPdfUploads: false,
    allowLabelExports: false,
    allowBadgeCustomization: false,
    allowBulkCsv: false,
    bulkOperations: false,
  },
  "pro-plan": {
    maxPassports: 250,
    allowTranslations: true,
    allowPdfUploads: true,
    allowLabelExports: true,
    allowBadgeCustomization: false,
    allowBulkCsv: false,
    bulkOperations: false,
  },
  "scale-plan": {
    maxPassports: null,
    allowTranslations: true,
    allowPdfUploads: true,
    allowLabelExports: true,
    allowBadgeCustomization: true,
    allowBulkCsv: true,
    bulkOperations: true,
  },
}

/**
 * Backward-compatible shape used by older call sites.
 * Prefer {@link PLAN_LIMITS} for new code.
 */
export const TIER_LIMITS: Record<
  PlanHandle,
  {
    maxPassports: number | null
    maxSyncedProducts: number | null
    evidenceUploads: boolean
    bulkOperations: boolean
    allowTranslations: boolean
    allowLabelExports: boolean
    allowBadgeCustomization: boolean
    allowBulkCsv: boolean
  }
> = {
  free: {
    maxPassports: PLAN_LIMITS.free.maxPassports,
    maxSyncedProducts: PLAN_LIMITS.free.maxPassports,
    evidenceUploads: PLAN_LIMITS.free.allowPdfUploads,
    bulkOperations: PLAN_LIMITS.free.bulkOperations,
    allowTranslations: PLAN_LIMITS.free.allowTranslations,
    allowLabelExports: PLAN_LIMITS.free.allowLabelExports,
    allowBadgeCustomization: PLAN_LIMITS.free.allowBadgeCustomization,
    allowBulkCsv: PLAN_LIMITS.free.allowBulkCsv,
  },
  "pro-plan": {
    maxPassports: PLAN_LIMITS["pro-plan"].maxPassports,
    maxSyncedProducts: PLAN_LIMITS["pro-plan"].maxPassports,
    evidenceUploads: PLAN_LIMITS["pro-plan"].allowPdfUploads,
    bulkOperations: PLAN_LIMITS["pro-plan"].bulkOperations,
    allowTranslations: PLAN_LIMITS["pro-plan"].allowTranslations,
    allowLabelExports: PLAN_LIMITS["pro-plan"].allowLabelExports,
    allowBadgeCustomization: PLAN_LIMITS["pro-plan"].allowBadgeCustomization,
    allowBulkCsv: PLAN_LIMITS["pro-plan"].allowBulkCsv,
  },
  "scale-plan": {
    maxPassports: PLAN_LIMITS["scale-plan"].maxPassports,
    maxSyncedProducts: PLAN_LIMITS["scale-plan"].maxPassports,
    evidenceUploads: PLAN_LIMITS["scale-plan"].allowPdfUploads,
    bulkOperations: PLAN_LIMITS["scale-plan"].bulkOperations,
    allowTranslations: PLAN_LIMITS["scale-plan"].allowTranslations,
    allowLabelExports: PLAN_LIMITS["scale-plan"].allowLabelExports,
    allowBadgeCustomization: PLAN_LIMITS["scale-plan"].allowBadgeCustomization,
    allowBulkCsv: PLAN_LIMITS["scale-plan"].allowBulkCsv,
  },
}

export function planLimitsFor(handle: PlanHandle) {
  return PLAN_LIMITS[handle] ?? PLAN_LIMITS.free
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "pro-plan" || value === "scale-plan"
}

/**
 * Normalize DB / webhook / Partner values to a plan handle.
 * Accepts legacy `grower` / `enterprise` rows until migration completes.
 */
export function normalizeTier(raw: unknown): PlanHandle {
  if (raw === "pro-plan" || raw === "pro" || raw === "grower") return "pro-plan"
  if (raw === "scale-plan" || raw === "scale" || raw === "enterprise") return "scale-plan"
  return "free"
}

/** Map a Shopify AppSubscription name (or managed-pricing handle) back to our tier. */
export function tierForSubscriptionName(name: string | null | undefined): PlanHandle {
  const normalized = (name ?? "").toLowerCase().trim()
  if (!normalized) return "free"
  if (
    normalized === "scale-plan" ||
    normalized.includes("scale") ||
    normalized.includes("enterprise")
  ) {
    return "scale-plan"
  }
  if (
    normalized === "pro-plan" ||
    normalized.includes("pro") ||
    normalized.includes("grower")
  ) {
    return "pro-plan"
  }
  return "free"
}

export function passportLimitLabel(tier: PlanHandle): string {
  const max = PLAN_LIMITS[tier].maxPassports
  return max == null ? "unlimited" : String(max)
}

export function upgradePassportLimitMessage(currentCount: number, tier: PlanHandle = "free"): string {
  if (tier === "free") {
    return `You've reached the Starter Free limit of ${PLAN_LIMITS.free.maxPassports} passports (${currentCount} in use). Upgrade to Pro for up to 250 items.`
  }
  if (tier === "pro-plan") {
    return `You've reached the Pro plan limit of ${PLAN_LIMITS["pro-plan"].maxPassports} passports (${currentCount} in use). Upgrade to Scale for unlimited passports.`
  }
  return "Passport limit reached."
}

export async function countPassportsForOrganization(orgId: string): Promise<number> {
  if (!orgId) return 0
  try {
    const supabase = createServerSupabaseClient()
    const { count } = await supabase
      .from("passports")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
    return count ?? 0
  } catch {
    return 0
  }
}

/**
 * Whether `additional` new passport rows may be created under the plan.
 */
export function canCreatePassports(
  tier: PlanHandle,
  currentCount: number,
  additional = 1,
): boolean {
  const max = PLAN_LIMITS[tier].maxPassports
  if (max == null) return true
  return currentCount + additional <= max
}

/** Read the store's tier by shop domain. Fails safe to "free". */
export async function getSubscriptionTier(shop: string): Promise<PlanHandle> {
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

export async function getSubscriptionTierForOrgId(orgId: string | null | undefined): Promise<PlanHandle> {
  if (!orgId) return "free"
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("id", orgId)
      .maybeSingle()
    return normalizeTier((data as { subscription_tier?: string | null } | null)?.subscription_tier)
  } catch {
    return "free"
  }
}

/** Shopify AppSubscription GID tracked for this shop, if any. */
export async function getTrackedSubscriptionId(shop: string): Promise<string | null> {
  if (!isValidShopDomain(shop)) return null
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from("organizations")
      .select("shopify_subscription_id")
      .eq("shop_domain", shop)
      .maybeSingle()
    const id = (data as { shopify_subscription_id?: string | null } | null)?.shopify_subscription_id
    return typeof id === "string" && id.trim() ? id.trim() : null
  } catch {
    return null
  }
}

/**
 * Prefer test charges unless production live billing is explicitly enabled.
 *
 * - Default / App Store review: `test: true` (no real card charge)
 * - `SHOPIFY_BILLING_LIVE=1`: live charges for production merchants
 * - `SHOPIFY_BILLING_FORCE_TEST=1`: keeps test mode even when LIVE=1
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
          // Include handle so webhook name→tier mapping stays unambiguous.
          name: `${planDef.name} (${planDef.handle})`,
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
 * Cancel the merchant's active app subscription via Admin GraphQL.
 * Tier flips to free only when `app_subscriptions/update` arrives — do not
 * mutate `subscription_tier` here.
 */
export async function cancelAppSubscription(input: {
  shop: string
  adminToken: string
  subscriptionId: string
}): Promise<{ ok: true; status: string | null } | { error: string }> {
  const { shop, adminToken, subscriptionId } = input
  if (!isValidShopDomain(shop) || !adminToken) return { error: "Store not connected." }
  if (!subscriptionId.trim()) return { error: "No active Shopify subscription to cancel." }

  const mutation = /* GraphQL */ `
    mutation CancelAppSubscription($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription { id status }
        userErrors { field message }
      }
    }
  `

  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": adminToken },
      body: JSON.stringify({ query: mutation, variables: { id: subscriptionId } }),
      cache: "no-store",
    })
    if (!res.ok) return { error: "Could not reach Shopify billing." }

    const json = (await res.json()) as {
      errors?: Array<{ message?: string }>
      data?: {
        appSubscriptionCancel?: {
          appSubscription?: { id?: string; status?: string } | null
          userErrors?: Array<{ message?: string }>
        }
      }
    }

    const result = json.data?.appSubscriptionCancel
    const userError = result?.userErrors?.[0]?.message ?? json.errors?.[0]?.message
    if (userError) return { error: userError }
    if (!result?.appSubscription?.id) {
      return { error: "Shopify did not confirm the cancellation." }
    }
    return { ok: true, status: result.appSubscription.status ?? null }
  } catch (err) {
    console.error("[shopify-billing] subscription cancel failed:", err)
    return { error: "Billing cancellation failed. Please try again." }
  }
}

/**
 * Cancel the tracked charge (if any), then create a new paid plan charge.
 * Returns Shopify's confirmation URL for top-level approval.
 */
export async function switchPaidPlan(input: {
  shop: string
  adminToken: string
  plan: PaidPlan
  returnUrl: string
  currentSubscriptionId?: string | null
}): Promise<{ confirmationUrl: string; subscriptionId: string } | { error: string }> {
  const tracked = input.currentSubscriptionId?.trim() || (await getTrackedSubscriptionId(input.shop))
  if (tracked) {
    const cancelled = await cancelAppSubscription({
      shop: input.shop,
      adminToken: input.adminToken,
      subscriptionId: tracked,
    })
    if ("error" in cancelled) return cancelled
  }
  return createSubscriptionConfirmationUrl({
    shop: input.shop,
    adminToken: input.adminToken,
    plan: input.plan,
    returnUrl: input.returnUrl,
  })
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
    const { scheduleShopPlanMetafieldSync } = await import("@/lib/shopify-plan-metafield")
    scheduleShopPlanMetafieldSync(shop, tier)
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
    const { scheduleShopPlanMetafieldSync } = await import("@/lib/shopify-plan-metafield")
    scheduleShopPlanMetafieldSync(shop, "free")
  }
}
