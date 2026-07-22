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

  // Order matters. App Bridge intercepts *anchor clicks* inside the Admin iframe and
  // routes them through the host — so a synthesized <a target="_blank"> opened the
  // passport twice (new tab + navigated Admin). `window.open` is not intercepted that
  // way, so it goes first.
  //
  // IMPORTANT: `window.open(url, "_blank", "noopener")` returns `null` in Chrome even
  // when the tab opens successfully. Null is therefore NOT treated as a failure — only
  // a thrown error is. Treating null as "blocked" is what caused the double-open.
  try {
    window.open(target, "_blank", "noopener,noreferrer")
    return true
  } catch {
    // fall through — genuinely unavailable, not merely a null handle.
  }

  // Last resort only, when window.open itself threw. Still never navigate `_top` here:
  // public /sp pages send X-Frame-Options: SAMEORIGIN, but replacing the Admin shell
  // loses the merchant's place in the app, which is worse than a blocked popup.
  try {
    const anchor = document.createElement("a")
    anchor.href = target
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    anchor.setAttribute("data-originpass-external", "1")
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
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
