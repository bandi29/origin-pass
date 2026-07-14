/** Shopify store subdomain from a `*.myshopify.com` host or bare subdomain. */
export function shopSubdomainFromDomain(shop: string): string {
  const raw = shop.trim().toLowerCase()
  return raw.endsWith(".myshopify.com") ? raw.replace(/\.myshopify\.com$/, "") : raw
}

/**
 * Short public passport URL for QR labels — no query string.
 * `/sp/{shop}/{productId}` → same consumer passport as `/shop/{shop}/{productId}`.
 * (Uses `/sp/` not `/s/` — `/s/[passportId]` is reserved for UUID passport redirects.)
 */
export function buildShopifyPublicPassportUrl(shopDomain: string, externalProductId: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")
  const shop = encodeURIComponent(shopSubdomainFromDomain(shopDomain))
  const productId = encodeURIComponent(externalProductId.trim())
  return `${base}/sp/${shop}/${productId}`
}

/** Canonical long-form path (same page content). */
export function buildShopifyPublicPassportPath(shopDomain: string, externalProductId: string): string {
  const shop = encodeURIComponent(shopSubdomainFromDomain(shopDomain))
  const productId = encodeURIComponent(externalProductId.trim())
  return `/shop/${shop}/${productId}`
}
