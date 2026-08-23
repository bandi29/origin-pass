import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { exchangeCodeForTokenGrant, isValidShopDomain, verifyShopifyHmac, buildShopifyEmbeddedAppReturnUrl } from "@/lib/shopify"

export const dynamic = "force-dynamic"

/**
 * Shopify OAuth callback.
 *
 * Flow: validate params → verify HMAC → exchange `code` for an offline access
 * token → upsert the store row in Supabase (`organizations`, keyed by
 * `shop_domain`) → redirect back into the embedded app home.
 */
function oauthFailureRedirect(shop: string | null, host: string, reason: string): NextResponse {
  const embeddedReturn = shop ? buildShopifyEmbeddedAppReturnUrl(shop, host) : null
  if (embeddedReturn) {
    const url = new URL(embeddedReturn)
    url.searchParams.set("oauth_error", reason)
    return NextResponse.redirect(url)
  }
  return NextResponse.json({ error: reason }, { status: 400 })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const shop = params.get("shop")
  const code = params.get("code")
  // OAuth `state` carries the embedded admin `host` param we set at authorize time.
  const host = params.get("state") ?? params.get("host") ?? ""
  const oauthError = params.get("error")

  // Shopify may bounce back with error=access_denied (no code). Never leave the
  // merchant on a raw JSON 400 inside Admin — send them home with a flag.
  if (oauthError) {
    console.warn("[shopify/auth/callback] provider error:", oauthError, params.get("error_description"))
    return oauthFailureRedirect(shop, host, oauthError)
  }

  // 1. Validate the inputs we control redirects/queries with.
  if (!isValidShopDomain(shop) || !code) {
    console.warn("[shopify/auth/callback] missing shop/code", {
      hasShop: Boolean(shop),
      hasCode: Boolean(code),
      keys: [...params.keys()],
    })
    return oauthFailureRedirect(shop, host, "invalid_oauth_request")
  }

  // 2. Confirm the request genuinely came from Shopify.
  if (!verifyShopifyHmac(params)) {
    console.warn("[shopify/auth/callback] HMAC validation failed for", shop)
    return oauthFailureRedirect(shop, host, "hmac_failed")
  }

  // 3. Trade the temporary code for the offline token GRANT (Shopify now issues
  // expiring tokens — access_token + expires_in + refresh_token — and the Admin
  // API rejects legacy non-expiring tokens).
  const grant = await exchangeCodeForTokenGrant(shop, code)
  if (!grant) {
    // Usually a reused one-time `code` (merchant refreshed the callback tab) or
    // a client_secret mismatch — never leave them on raw JSON in the browser.
    console.error("[shopify/auth/callback] token exchange failed for", shop)
    return oauthFailureRedirect(shop, host, "token_exchange_failed")
  }

  const tokenFields = {
    shopify_access_token: grant.accessToken,
    shopify_refresh_token: grant.refreshToken,
    shopify_token_expires_at: grant.expiresAt,
  }

  // 4. Persist the grant without wiping merchant-entered fallback config.
  const supabase = createServerSupabaseClient()
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("shop_domain", shop)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from("organizations")
      .update({
        ...tokenFields,
        name: shop,
        shopify_install_status: "active",
        shopify_uninstalled_at: null,
        shopify_redacted_at: null,
      })
      .eq("shop_domain", shop)
    if (error) {
      console.error("[shopify/auth/callback] store update failed:", error.message)
      return oauthFailureRedirect(shop, host, "persist_failed")
    }
  } else {
    const { error } = await supabase.from("organizations").insert({
      shop_domain: shop,
      ...tokenFields,
      name: shop,
      shopify_install_status: "active",
      global_production_location: null,
      global_care_instructions: null,
    })
    if (error) {
      console.error("[shopify/auth/callback] store insert failed:", error.message)
      return oauthFailureRedirect(shop, host, "persist_failed")
    }
  }

  // 5. Return to embedded Shopify admin (not a bare tunnel URL in the iframe).
  const embeddedReturn = buildShopifyEmbeddedAppReturnUrl(shop, host)
  if (embeddedReturn) {
    return NextResponse.redirect(embeddedReturn)
  }

  const home = new URL("/api/shopify", request.nextUrl.origin)
  home.searchParams.set("embedded", "1")
  home.searchParams.set("shop", shop)
  if (host) home.searchParams.set("host", host)
  return NextResponse.redirect(home)
}
