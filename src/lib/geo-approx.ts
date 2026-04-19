/**
 * Rough coordinates for map overlays when only country/city text is available.
 * Not for navigation — stable jitter per location string for clustering heuristics.
 */

const COUNTRY_CENTERS: Record<string, { lat: number; long: number }> = {
  nigeria: { lat: 9.082, long: 8.6753 },
  "united kingdom": { lat: 54.7023, long: -3.2766 },
  "united states": { lat: 39.8283, long: -98.5795 },
  singapore: { lat: 1.3521, long: 103.8198 },
  "united arab emirates": { lat: 23.4241, long: 53.8478 },
  canada: { lat: 56.1304, long: -106.3468 },
  germany: { lat: 51.1657, long: 10.4515 },
  france: { lat: 46.6034, long: 1.8883 },
  japan: { lat: 36.2048, long: 138.2529 },
  portugal: { lat: 39.3999, long: -8.2245 },
  switzerland: { lat: 46.8182, long: 8.2275 },
  india: { lat: 20.5937, long: 78.9629 },
  australia: { lat: -25.2744, long: 133.7751 },
  brazil: { lat: -14.235, long: -51.9253 },
  mexico: { lat: 23.6345, long: -102.5528 },
  spain: { lat: 40.4637, long: -3.7492 },
  italy: { lat: 41.8719, long: 12.5674 },
  netherlands: { lat: 52.1326, long: 5.2913 },
  "south korea": { lat: 35.9078, long: 127.7669 },
  china: { lat: 35.8617, long: 104.1954 },
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function approxCoordsFromLocation(
  country: string | null | undefined,
  city: string | null | undefined
): { lat: number; long: number } {
  const key = (country ?? "").trim().toLowerCase()
  const base = COUNTRY_CENTERS[key] ?? { lat: 20, long: 0 }
  const h = hashString(`${city ?? ""}|${country ?? ""}`)
  const jLat = ((h % 1000) / 5000) * (city ? 1 : 3)
  const jLng = (((h / 1000) % 1000) / 5000) * (city ? 1 : 3)
  return { lat: base.lat + jLat, long: base.long + jLng }
}
