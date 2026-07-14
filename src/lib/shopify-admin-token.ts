/**
 * Single source for a VALID Shopify Admin token per shop.
 *
 * Shopify offline tokens are now expiring (≈24h) with a rotating refresh token.
 * Every Admin API caller must go through `getShopifyAdminToken` instead of
 * reading `organizations.shopify_access_token` directly — this helper refreshes
 * (and persists the rotated grant) when the stored token is at/near expiry.
 */

import { createServerSupabaseClient } from "@/lib/supabase"
import { isValidShopDomain, refreshShopifyTokenGrant } from "@/lib/shopify"

/** Refresh this long before actual expiry so in-flight requests never race it. */
const EXPIRY_MARGIN_MS = 2 * 60 * 1000

type TokenRow = {
  shopify_access_token: string | null
  shopify_refresh_token: string | null
  shopify_token_expires_at: string | null
}

/** Per-process de-dupe: concurrent callers share one refresh round-trip. */
const inflight = new Map<string, Promise<string | null>>()

export async function getShopifyAdminToken(shop: string): Promise<string | null> {
  if (!isValidShopDomain(shop)) return null

  const existing = inflight.get(shop)
  if (existing) return existing

  const promise = resolveToken(shop).finally(() => inflight.delete(shop))
  inflight.set(shop, promise)
  return promise
}

async function resolveToken(shop: string): Promise<string | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("organizations")
    .select("shopify_access_token, shopify_refresh_token, shopify_token_expires_at")
    .eq("shop_domain", shop)
    .maybeSingle()

  const row = data as TokenRow | null
  if (!row?.shopify_access_token) return null

  const expiresAt = row.shopify_token_expires_at ? Date.parse(row.shopify_token_expires_at) : null
  const stillValid = expiresAt == null || expiresAt - Date.now() > EXPIRY_MARGIN_MS

  // Legacy grants (no expiry recorded) are returned as-is: if Shopify rejects
  // them the merchant must re-authorize — we cannot refresh without a token.
  if (stillValid || !row.shopify_refresh_token) return row.shopify_access_token

  const rotated = await refreshShopifyTokenGrant(shop, row.shopify_refresh_token)
  if (!rotated) {
    // Refresh failed (revoked / uninstalled). Return the stale token so the
    // caller gets Shopify's real error rather than a silent null.
    return row.shopify_access_token
  }

  await supabase
    .from("organizations")
    .update({
      shopify_access_token: rotated.accessToken,
      shopify_refresh_token: rotated.refreshToken ?? row.shopify_refresh_token,
      shopify_token_expires_at: rotated.expiresAt,
    })
    .eq("shop_domain", shop)

  return rotated.accessToken
}
