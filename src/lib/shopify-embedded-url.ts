/**
 * Escape the Shopify admin iframe for URLs that must not load as the iframe document.
 *
 * - `"blank"` — public consumer pages (`/sp`, `/shop`), certificates, etc. that send
 *   `X-Frame-Options: SAMEORIGIN` (Chrome: "refused to connect" if left in-iframe).
 * - `"top"` — Shopify OAuth / Billing approval URLs that must replace the Admin shell.
 */
export type ShopifyExternalOpenMode = "blank" | "top"

export function openOutsideShopifyEmbed(
  url: string,
  mode: ShopifyExternalOpenMode = "blank",
): boolean {
  if (typeof window === "undefined") return false
  const target = String(url || "").trim()
  if (!target) return false

  if (mode === "top") {
    try {
      const opened = window.open(target, "_top")
      if (opened !== null || window.shopify) return true
    } catch {
      // fall through
    }
    try {
      ;(window.top ?? window).location.href = target
      return true
    } catch {
      return false
    }
  }

  try {
    const opened = window.open(target, "_blank", "noopener,noreferrer")
    if (opened) return true
  } catch {
    // fall through
  }
  // Popup blocked: break out of the iframe rather than navigating _self (SAMEORIGIN).
  try {
    window.open(target, "_top")
    return true
  } catch {
    return false
  }
}

/** True when a path must never load as the Shopify admin iframe document. */
export function isShopifyIframeBlockedPath(pathnameOrUrl: string): boolean {
  try {
    const path = pathnameOrUrl.startsWith("http")
      ? new URL(pathnameOrUrl).pathname
      : pathnameOrUrl.split("?")[0] || ""
    return /^\/(sp|shop|p|s|scan)(\/|$)/i.test(path)
  } catch {
    return false
  }
}

/** Build in-app URLs that work inside the Shopify admin iframe. */
export function shopifyEmbeddedQueryString(params: {
  embedded?: string | null
  shop?: string | null
  host?: string | null
}): string {
  const qs = new URLSearchParams()
  if (params.shop) qs.set("shop", params.shop)
  if (params.host) qs.set("host", params.host)
  // Keep embed params on in-app links so `/` never falls through to next-intl (X-Frame-Options blank iframe).
  if (params.shop && params.host) {
    qs.set("embedded", params.embedded || "1")
  } else if (params.embedded) {
    qs.set("embedded", params.embedded)
  }
  return qs.toString()
}

/** Home screen — Shopify loads `application_url/` with embed query params. */
export function shopifyEmbeddedHomeHref(params: {
  embedded?: string | null
  shop?: string | null
  host?: string | null
}): string {
  const qs = shopifyEmbeddedQueryString(params)
  const base = params.embedded ? "/" : "/api/shopify"
  return qs ? `${base}?${qs}` : base
}

/** Per-product passport editor. Embedded requests use `/products/:id` (rewritten in proxy.ts). */
export function shopifyEmbeddedProductEditorHref(
  productId: string,
  params: {
    embedded?: string | null
    shop?: string | null
    host?: string | null
  },
): string {
  const qs = shopifyEmbeddedQueryString(params)
  const base = params.embedded
    ? `/products/${productId}`
    : `/api/shopify/products/${productId}`
  return qs ? `${base}?${qs}` : base
}
