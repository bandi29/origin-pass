/**
 * Single source for a VALID Shopify Admin token per shop.
 *
 * Shopify offline tokens are now expiring (≈1h) with a rotating refresh token.
 * Every Admin API caller must go through `getShopifyAdminToken` instead of
 * reading `organizations.shopify_access_token` directly — this helper:
 *   1. Migrates legacy non-expiring tokens → expiring grants (one-time)
 *   2. Refreshes (and persists the rotated grant) when near expiry
 *
 * Using a non-expiring offline token against Admin APIs triggers the Dev
 * Dashboard "deprecated offline tokens" warning.
 */

import { createServerSupabaseClient } from "@/lib/supabase"
import {
  isValidShopDomain,
  migrateNonExpiringOfflineToken,
  refreshShopifyTokenGrant,
  type ShopifyTokenGrant,
} from "@/lib/shopify"

/** Refresh this long before actual expiry so in-flight requests never race it. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000

type TokenRow = {
  shopify_access_token: string | null
  shopify_refresh_token: string | null
  shopify_token_expires_at: string | null
}

/** Per-process de-dupe: concurrent callers share one refresh/migrate round-trip. */
const inflight = new Map<string, Promise<string | null>>()

export async function getShopifyAdminToken(shop: string): Promise<string | null> {
  if (!isValidShopDomain(shop)) return null

  const existing = inflight.get(shop)
  if (existing) return existing

  const promise = resolveToken(shop).finally(() => inflight.delete(shop))
  inflight.set(shop, promise)
  return promise
}

async function persistGrant(
  shop: string,
  grant: ShopifyTokenGrant,
  previousRefreshToken: string | null,
): Promise<void> {
  const supabase = createServerSupabaseClient()
  await supabase
    .from("organizations")
    .update({
      shopify_access_token: grant.accessToken,
      shopify_refresh_token: grant.refreshToken ?? previousRefreshToken,
      shopify_token_expires_at: grant.expiresAt,
    })
    .eq("shop_domain", shop)
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

  // Legacy non-expiring grant (no refresh material) — migrate once, irreversibly.
  // Continuing to call Admin APIs with these tokens is what trips the dashboard warning.
  if (!row.shopify_refresh_token || !row.shopify_token_expires_at) {
    const migrated = await migrateNonExpiringOfflineToken(shop, row.shopify_access_token)
    if (!migrated) {
      console.error(
        `[shopify-admin-token] cannot migrate legacy offline token for ${shop} — merchant must re-authorize`,
      )
      return null
    }
    await persistGrant(shop, migrated, null)
    return migrated.accessToken
  }

  const expiresAt = Date.parse(row.shopify_token_expires_at)
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > EXPIRY_MARGIN_MS
  if (stillValid) return row.shopify_access_token

  const rotated = await refreshShopifyTokenGrant(shop, row.shopify_refresh_token)
  if (!rotated) {
    // Refresh failed (revoked / uninstalled / refresh expired). Force re-auth —
    // do not keep serving a near-expired or retired access token.
    console.error(`[shopify-admin-token] refresh failed for ${shop} — merchant must re-authorize`)
    return null
  }

  await persistGrant(shop, rotated, row.shopify_refresh_token)
  return rotated.accessToken
}
