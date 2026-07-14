/**
 * Edge platforms often send city as percent-encoded or with + for space.
 */
export function decodeGeoHeader(value: string | null | undefined): string | null {
  if (value == null || value === "") return null
  const raw = value.trim()
  if (!raw) return null
  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim() || null
  } catch {
    return raw
  }
}

/** Optional local/dev geo when Vercel / Cloudflare headers are absent. */
export function devFallbackGeo(): { country: string | null; city: string | null } {
  if (process.env.NODE_ENV !== "development") {
    return { country: null, city: null }
  }
  const country = process.env.DEV_SCAN_GEO_COUNTRY?.trim() || null
  const city = process.env.DEV_SCAN_GEO_CITY?.trim() || null
  return { country, city }
}
