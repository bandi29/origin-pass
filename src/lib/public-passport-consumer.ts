/**
 * B2C public passport / claim flows: resolve "home" navigation without exposing the B2B dashboard.
 */

function readBrandUrlFromRecord(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null
  const rec = meta as Record<string, unknown>
  const raw = rec.brand_url ?? rec.brandUrl
  if (typeof raw !== "string") return null
  const t = raw.trim()
  if (!t) return null
  if (t.startsWith("http://") || t.startsWith("https://")) return t
  return null
}

/** Prefer passport metadata, then product metadata. Only absolute http(s) URLs are used. */
export function extractBrandHomeUrlFromMetadata(
  passportMetadata: unknown,
  productMetadata: unknown,
): string | null {
  return (
    readBrandUrlFromRecord(passportMetadata) ?? readBrandUrlFromRecord(productMetadata) ?? null
  )
}

/**
 * Where the consumer "Home" control should navigate: brand site when configured, else marketing `/`.
 * Pass the result into `PassportNavLink` / `resolvePassportPublicHref` for locale-prefixed app paths.
 */
export function resolveConsumerHomeHref(brandHomeUrl: string | null): string {
  return brandHomeUrl ?? "/"
}

function isTruthyQueryParam(value: string | string[] | undefined | null): boolean {
  const v = Array.isArray(value) ? value[0] : value
  return v === "true" || v === "1"
}

function readQueryParam(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
  key: string,
): string | null {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key)
  }
  const raw = searchParams[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value ?? null
}

/**
 * Admin QA links (`?preview=true` or `?admin=true`) should render the public page
 * but must not insert scan telemetry rows.
 */
export function shouldBypassScanTelemetry(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams | null | undefined,
): boolean {
  if (!searchParams) return false
  return (
    isTruthyQueryParam(readQueryParam(searchParams, "preview")) ||
    isTruthyQueryParam(readQueryParam(searchParams, "admin"))
  )
}

/** Dev-only confirmation when preview/admin mode skips processScan(). */
export function logScanTelemetryBypassIfDev(): void {
  if (process.env.NODE_ENV === "development") {
    console.log("Bypassing scan telemetry write: Admin Preview Mode")
  }
}

/** Admin dashboard opened the public passport in a preview tab (not a consumer QR scan). */
export function isAdminPassportPreview(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams | null | undefined,
): boolean {
  return shouldBypassScanTelemetry(searchParams)
}

/** Append `preview=true` for dashboard "open passport" links that should show Close Preview chrome. */
export function appendPassportPreviewQuery(url: string): string {
  try {
    const parsed = new URL(url, "https://originpass.local")
    parsed.searchParams.set("preview", "true")
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return parsed.toString()
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    const join = url.includes("?") ? "&" : "?"
    return `${url}${join}preview=true`
  }
}
