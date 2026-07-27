/**
 * Escape the Shopify admin iframe for URLs that must not load as the iframe document.
 *
 * - `"blank"` — public consumer pages (`/sp`, `/shop`), certificates, etc. that send
 *   `X-Frame-Options: SAMEORIGIN` (Chrome: "refused to connect" if left in-iframe).
 * - `"top"` — Shopify OAuth / Billing approval URLs that must replace the Admin shell.
 */
export type ShopifyExternalOpenMode = "blank" | "top"

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase()
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1"
}

/**
 * Server actions bake `NEXT_PUBLIC_BASE_URL` (often `http://localhost:3000` in .env.local).
 * During `shopify:dev` the Admin iframe is served from the Cloudflare tunnel host, so
 * opening localhost in a new tab is confusing / wrong for merchants. Rewrite loopback
 * public URLs to the current embed origin (tunnel or production).
 */
export function resolveShopifyPublicOpenUrl(url: string, embedOrigin?: string): string {
  const raw = String(url || "").trim()
  if (!raw) return raw
  const originHint =
    embedOrigin ??
    (typeof window !== "undefined" ? window.location?.origin ?? "" : "")
  try {
    const parsed = new URL(raw, originHint || "http://localhost:3000")
    if (!isLoopbackHost(parsed.hostname)) return parsed.toString()
    if (!originHint) return parsed.toString()
    const origin = new URL(originHint)
    if (isLoopbackHost(origin.hostname)) return parsed.toString()
    // Rebuild from embed origin so localhost:3000 does not keep a stale port.
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, origin.origin).toString()
  } catch {
    return raw
  }
}

/**
 * Absolute URL for top-level navigation out of the Admin iframe.
 * Relative paths like `/api/shopify/auth` resolve against `admin.shopify.com` when
 * assigned to `window.top` — breaking OAuth. Always anchor to the iframe origin.
 */
export function absolutizeEmbedUrl(url: string, embedOrigin?: string): string {
  const raw = String(url || "").trim()
  if (!raw) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  const origin =
    embedOrigin ||
    (typeof window !== "undefined" ? window.location?.origin ?? "" : "")
  if (!origin) return raw
  try {
    return new URL(raw, origin).toString()
  } catch {
    return raw
  }
}

export function openOutsideShopifyEmbed(
  url: string,
  mode: ShopifyExternalOpenMode = "blank",
): boolean {
  if (typeof window === "undefined") return false
  const resolved = String(url || "").trim()
  if (!resolved) return false
  // Public passport / certificate links: prefer tunnel/prod origin over baked localhost.
  // OAuth / billing (`top`): absolutize so top-window navigation stays on the app host.
  const target =
    mode === "blank"
      ? resolveShopifyPublicOpenUrl(resolved)
      : absolutizeEmbedUrl(resolved)

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
