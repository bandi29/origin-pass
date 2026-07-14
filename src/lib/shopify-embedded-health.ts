/** Matches Shopify admin `shop` query param values. */
export const SHOPIFY_MYSHOPIFY_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/

/**
 * True when the request should be treated as a Shopify admin iframe entry.
 * Requires `embedded=1`, or both `shop` and `host` (Shopify always sends host in the iframe).
 * Without this, `/` falls through to next-intl and redirects to `/en` with X-Frame-Options — blank iframe.
 */
export function isShopifyEmbeddedEntryQuery(params: {
  get(name: string): string | null
}): boolean {
  const shop = params.get("shop")
  if (!shop || !SHOPIFY_MYSHOPIFY_DOMAIN.test(shop)) return false
  if (params.get("embedded") === "1") return true
  return Boolean(params.get("host"))
}

/** Server-rendered / smoke-test markers for the Shopify embedded home screen. */
export const EMBEDDED_HOME_MARKERS = [
  "Store configuration",
  "Brand defaults",
  "Hook active",
] as const

/** Markers for the per-product passport editor embedded route. */
export const EMBEDDED_PRODUCT_EDITOR_MARKERS = [
  "Back to store configuration",
  "Save product",
] as const

export type EmbeddedPageKind = "home" | "product-editor"

const MARKERS_BY_PAGE: Record<EmbeddedPageKind, readonly string[]> = {
  home: EMBEDDED_HOME_MARKERS,
  "product-editor": EMBEDDED_PRODUCT_EDITOR_MARKERS,
}

/** Returns missing content markers — empty array means the shell looks healthy. */
export function validateEmbeddedPageShell(html: string, page: EmbeddedPageKind): string[] {
  return MARKERS_BY_PAGE[page].filter((marker) => !html.includes(marker))
}

/** True when a module default export is a function (page/component). */
export function isRenderableEmbeddedExport(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function"
}

/** Guard against accidental removal of critical embedded route modules. */
export function canImportEmbeddedHome(mod: { default?: unknown }): boolean {
  return isRenderableEmbeddedExport(mod.default)
}
