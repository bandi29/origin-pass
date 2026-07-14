import { getClientIp } from "@/lib/client-ip"
import { decodeGeoHeader, devFallbackGeo } from "@/lib/geo-headers"

export const UNKNOWN_LOCATION = "Unknown Location"

export type ScanRequestMetadata = {
  ipAddress: string | null
  userAgent: string | null
  country: string
  region: string | null
  city: string | null
  /** Human-readable geo label for logs and metadata_json. */
  locationLabel: string
}

function readCountryHeader(headers: Headers): string | null {
  return (
    headers.get("x-vercel-ip-country")?.trim() ||
    headers.get("cf-ipcountry")?.trim() ||
    headers.get("cloudflare-ip-country")?.trim() ||
    null
  )
}

function readRegionHeader(headers: Headers): string | null {
  return (
    decodeGeoHeader(headers.get("x-vercel-ip-country-region")) ||
    decodeGeoHeader(headers.get("cf-region")) ||
    decodeGeoHeader(headers.get("cloudflare-region")) ||
    null
  )
}

function readCityHeader(headers: Headers): string | null {
  return decodeGeoHeader(headers.get("x-vercel-ip-city") || headers.get("cf-ipcity"))
}

export function formatScanLocationLabel(input: {
  city: string | null
  region: string | null
  country: string
}): string {
  const parts = [input.city, input.region, input.country].filter(
    (part): part is string => Boolean(part && part !== UNKNOWN_LOCATION),
  )
  if (parts.length === 0) return UNKNOWN_LOCATION
  return parts.join(", ")
}

/** Resolve consumer geo from trusted edge headers; never throws. */
export function extractScanRequestMetadata(request: Request): ScanRequestMetadata {
  const headers = request.headers
  const dev = devFallbackGeo()

  const country = readCountryHeader(headers) || dev.country || UNKNOWN_LOCATION
  const region = readRegionHeader(headers)
  const city = readCityHeader(headers) || dev.city || null

  return {
    ipAddress: getClientIp(headers),
    userAgent: headers.get("user-agent"),
    country,
    region,
    city,
    locationLabel: formatScanLocationLabel({ city, region, country }),
  }
}
