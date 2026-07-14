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
