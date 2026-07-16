import crypto from "node:crypto"

/** Shopify Admin/Storefront API version used across the integration. */
export const SHOPIFY_API_VERSION = "2024-10"

/** App secret from env (supports legacy SHOPIFY_API_SECRET_KEY alias). */
export function getShopifyApiSecret(): string | undefined {
  return process.env.SHOPIFY_API_SECRET ?? process.env.SHOPIFY_API_SECRET_KEY
}

/**
 * Guard the `shop` param to `brand.myshopify.com` shapes only. Every Shopify
 * request includes `shop`, and we interpolate it into URLs / redirects — so an
 * unvalidated value is an SSRF / open-redirect vector. Reject anything else.
 */
export function isValidShopDomain(shop: string | null | undefined): shop is string {
  if (!shop) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)
}

/**
 * Verify the `hmac` Shopify appends to install / OAuth requests.
 *
 * Recomputes HMAC-SHA256 (keyed by the app secret) over every query param
 * except `hmac`/`signature`, sorted lexicographically and `&`-joined, then
 * compares in constant time.
 */
export function verifyShopifyHmac(
  params: URLSearchParams,
  apiSecret: string | undefined = getShopifyApiSecret(),
): boolean {
  if (!apiSecret) return false
  const provided = params.get("hmac")
  if (!provided) return false

  const message = [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  const digest = crypto.createHmac("sha256", apiSecret).update(message).digest("hex")

  // timingSafeEqual throws on length mismatch, so length-check first.
  const expected = Buffer.from(digest, "utf8")
  const actual = Buffer.from(provided, "utf8")
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export type SessionTokenClaims = { shop: string }

/**
 * Verify an App Bridge **session token** (the JWT from `await shopify.idToken()`).
 *
 * It's HS256-signed with the app secret; `dest` is the shop origin. We verify the
 * signature (constant-time) + exp/nbf, then derive the shop from `dest` — so the
 * server trusts the token, not a client-supplied `shop` param. Returns null on any
 * failure.
 */
export function verifyShopifySessionToken(
  token: string | null | undefined,
  apiSecret: string | undefined = getShopifyApiSecret(),
): SessionTokenClaims | null {
  if (!apiSecret || !token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts

  const expected = crypto.createHmac("sha256", apiSecret).update(`${headerB64}.${payloadB64}`).digest("base64url")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signatureB64, "utf8")
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload: { exp?: number; nbf?: number; dest?: string }
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"))
  } catch {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === "number" && now >= payload.exp) return null
  if (typeof payload.nbf === "number" && now < payload.nbf) return null

  const shop = (payload.dest ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  return isValidShopDomain(shop) ? { shop } : null
}

/**
 * Verify a Shopify **webhook** request.
 *
 * Webhooks sign the *raw request body* (not the query string) with the app
 * secret and send the base64 digest in `X-Shopify-Hmac-Sha256`. Must be called
 * with the raw body string before any JSON parsing.
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null | undefined,
  apiSecret: string | undefined = getShopifyApiSecret(),
): boolean {
  if (!apiSecret || !hmacHeader) return false
  const digest = crypto.createHmac("sha256", apiSecret).update(rawBody, "utf8").digest("base64")
  const expected = Buffer.from(digest, "utf8")
  const actual = Buffer.from(hmacHeader, "utf8")
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export type ShopifyTokenGrant = {
  accessToken: string
  /** Present for expiring offline tokens (current Shopify requirement). */
  refreshToken: string | null
  /** ISO expiry derived from `expires_in`; null for legacy non-expiring grants. */
  expiresAt: string | null
  /** ISO expiry for the refresh token (≈90 days); null when not returned. */
  refreshExpiresAt: string | null
}

function parseTokenGrant(data: {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
}): ShopifyTokenGrant | null {
  if (!data.access_token) return null
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt:
      typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    refreshExpiresAt:
      typeof data.refresh_token_expires_in === "number" && Number.isFinite(data.refresh_token_expires_in)
        ? new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString()
        : null,
  }
}

/**
 * Exchange the OAuth `code` for an offline Admin token grant. Shopify now issues
 * EXPIRING offline tokens (access_token + expires_in + refresh_token) — legacy
 * non-expiring tokens are rejected by the Admin API — so the full grant must be
 * persisted, not just the access token.
 */
export async function exchangeCodeForTokenGrant(shop: string, code: string): Promise<ShopifyTokenGrant | null> {
  const apiKey = process.env.SHOPIFY_API_KEY
  const apiSecret = getShopifyApiSecret()
  if (!apiKey || !apiSecret || !isValidShopDomain(shop) || !code) return null

  try {
    // expiring=1 opts into EXPIRING offline tokens (access + refresh token) —
    // without it Shopify issues a legacy non-expiring token the Admin API rejects.
    // Sent in both the query string and the body: endpoint variants differ on
    // where they read it, and an ignored duplicate is harmless.
    const res = await fetch(`https://${shop}/admin/oauth/access_token?expiring=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code, expiring: 1 }),
    })
    if (!res.ok) return null
    const grant = parseTokenGrant((await res.json()) as Parameters<typeof parseTokenGrant>[0])
    if (grant && !grant.expiresAt) {
      console.warn(`[shopify] token exchange for ${shop} returned a NON-expiring grant (no expires_in) — Admin API will reject it`)
    }
    return grant
  } catch {
    return null
  }
}

/**
 * One-time irreversible migration: exchange a legacy non-expiring offline token
 * for an expiring offline grant (access + refresh). Required for public apps —
 * continued Admin API use of non-expiring tokens triggers the Dev Dashboard
 * "deprecated offline tokens" warning.
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 */
export async function migrateNonExpiringOfflineToken(
  shop: string,
  nonExpiringAccessToken: string,
): Promise<ShopifyTokenGrant | null> {
  const apiKey = process.env.SHOPIFY_API_KEY
  const apiSecret = getShopifyApiSecret()
  if (!apiKey || !apiSecret || !isValidShopDomain(shop) || !nonExpiringAccessToken) return null

  try {
    const body = new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: nonExpiringAccessToken,
      subject_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: "1",
    })
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    })
    if (!res.ok) {
      console.error(`[shopify] legacy token migration failed for ${shop}: HTTP ${res.status}`)
      return null
    }
    const grant = parseTokenGrant((await res.json()) as Parameters<typeof parseTokenGrant>[0])
    if (!grant?.refreshToken || !grant.expiresAt) {
      console.error(`[shopify] legacy token migration for ${shop} did not return an expiring grant`)
      return null
    }
    return grant
  } catch (err) {
    console.error("[shopify] legacy token migration error:", err)
    return null
  }
}

/** Rotate an expiring offline token using its refresh token. */
export async function refreshShopifyTokenGrant(
  shop: string,
  refreshToken: string,
): Promise<ShopifyTokenGrant | null> {
  const apiKey = process.env.SHOPIFY_API_KEY
  const apiSecret = getShopifyApiSecret()
  if (!apiKey || !apiSecret || !isValidShopDomain(shop) || !refreshToken) return null

  try {
    const body = new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    })
    if (!res.ok) {
      console.error(`[shopify] token refresh failed for ${shop}: HTTP ${res.status}`)
      return null
    }
    return parseTokenGrant((await res.json()) as Parameters<typeof parseTokenGrant>[0])
  } catch (err) {
    console.error("[shopify] token refresh error:", err)
    return null
  }
}

/** App origin during `shopify app dev` (HOST env) or the incoming request origin. */
export function resolveShopifyAppOrigin(fallbackOrigin: string): string {
  const raw = process.env.HOST || process.env.SHOPIFY_APP_URL
  if (!raw) return fallbackOrigin.replace(/\/$/, "")
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/$/, "")
  }
  return `https://${raw.replace(/\/$/, "")}`
}

/** OAuth redirect URI — must exactly match a URL whitelisted for the app. */
export function buildShopifyOAuthRedirectUri(fallbackOrigin: string): string {
  const origin = resolveShopifyAppOrigin(fallbackOrigin)
  return new URL("/api/shopify/auth/callback", origin).toString()
}

/** Build the Shopify Admin OAuth authorize URL for app install / reconnect. */
export function buildShopifyOAuthInstallUrl(
  shop: string,
  redirectUri: string,
  scopes: string[] = ["read_products", "write_products"],
): string | null {
  const apiKey = process.env.SHOPIFY_API_KEY
  if (!apiKey || !isValidShopDomain(shop) || !redirectUri) return null

  const url = new URL(`https://${shop}/admin/oauth/authorize`)
  url.searchParams.set("client_id", apiKey)
  url.searchParams.set("scope", scopes.join(","))
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("grant_options[]", "offline")
  return url.toString()
}

/** Redirect back into the embedded Shopify admin app after OAuth. */
export function buildShopifyEmbeddedAppReturnUrl(shop: string, host: string): string | null {
  const apiKey = process.env.SHOPIFY_API_KEY
  if (!apiKey || !isValidShopDomain(shop)) return null

  const storeHandle = shop.replace(/\.myshopify\.com$/, "")
  const url = new URL(`https://admin.shopify.com/store/${storeHandle}/apps/${apiKey}`)
  if (host) url.searchParams.set("host", host)
  return url.toString()
}

export type ShopifyProductSnapshot = {
  title: string
  imageUrl: string | null
}

/**
 * Fetch a product's title + primary image on the fly via the Admin GraphQL API,
 * using the store's stored offline token (kept server-side). Cached for 5 min.
 *
 * Note: we use the Admin API (not the public Storefront API) because OAuth gives
 * us the Admin offline token — the Storefront API needs a separately-provisioned
 * public token we don't hold here. The render path is a Server Component, so the
 * token never reaches the client. Returns null on any error → graceful fallback.
 */
export async function fetchShopifyProductSnapshot(
  shop: string,
  adminToken: string,
  productId: string,
): Promise<ShopifyProductSnapshot | null> {
  if (!isValidShopDomain(shop) || !adminToken || !productId) return null

  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`
  const query = /* GraphQL */ `
    query ProductSnapshot($id: ID!) {
      product(id: $id) {
        title
        featuredImage { url }
      }
    }
  `

  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": adminToken,
      },
      body: JSON.stringify({ query, variables: { id: gid } }),
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { product?: { title?: string; featuredImage?: { url?: string | null } | null } | null }
    }
    const product = json.data?.product
    if (!product?.title) return null
    return { title: product.title, imageUrl: product.featuredImage?.url ?? null }
  } catch {
    return null
  }
}
