import { NextRequest, NextResponse } from "next/server"

type NominatimItem = {
  name?: string
  display_name?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
  }
}

type CityAutocompleteResponse = {
  suggestions: string[]
  fallback?: boolean
  reason?: "rate_limited" | "provider_error" | "invalid_request"
}

const MAX_SUGGESTIONS = 8
const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHE_ENTRIES = 300

type CacheEntry = {
  suggestions: string[]
  expiresAt: number
}

const citySuggestionCache = new Map<string, CacheEntry>()

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function isAllowed(item: string): boolean {
  return item.length > 1
}

function getCacheKey(q: string, country: string, state: string): string {
  return `${normalize(country)}|${normalize(state)}|${normalize(q)}`
}

function getCachedSuggestions(cacheKey: string): string[] | null {
  const hit = citySuggestionCache.get(cacheKey)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    citySuggestionCache.delete(cacheKey)
    return null
  }
  return hit.suggestions
}

function setCachedSuggestions(cacheKey: string, suggestions: string[]): void {
  if (citySuggestionCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = citySuggestionCache.keys().next().value
    if (oldest) citySuggestionCache.delete(oldest)
  }
  citySuggestionCache.set(cacheKey, {
    suggestions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() || ""
  const country = url.searchParams.get("country")?.trim() || ""
  const state = url.searchParams.get("state")?.trim() || ""

  if (!q || !country || q.length < 2) {
    const payload: CityAutocompleteResponse = { suggestions: [], fallback: true, reason: "invalid_request" }
    return NextResponse.json(payload)
  }

  const cacheKey = getCacheKey(q, country, state)
  const cachedSuggestions = getCachedSuggestions(cacheKey)
  if (cachedSuggestions) {
    const payload: CityAutocompleteResponse = { suggestions: cachedSuggestions }
    return NextResponse.json(payload)
  }

  try {
    const params = new URLSearchParams({
      q: `${q}, ${state ? `${state}, ` : ""}${country}`,
      format: "jsonv2",
      addressdetails: "1",
      limit: String(MAX_SUGGESTIONS),
      dedupe: "1",
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": "OriginPass/1.0 (city-autocomplete)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      const payload: CityAutocompleteResponse = {
        suggestions: [],
        fallback: true,
        reason: response.status === 429 ? "rate_limited" : "provider_error",
      }
      return NextResponse.json(payload, { status: 200 })
    }

    const results = (await response.json()) as NominatimItem[]
    const seen = new Set<string>()
    const suggestions: string[] = []

    for (const item of results) {
      const place =
        item.address?.city ||
        item.address?.town ||
        item.address?.village ||
        item.address?.municipality ||
        item.address?.county ||
        item.name ||
        item.display_name?.split(",")[0] ||
        ""
      const normalized = normalize(place)
      if (!isAllowed(place) || seen.has(normalized)) continue
      seen.add(normalized)
      suggestions.push(place.trim())
      if (suggestions.length >= MAX_SUGGESTIONS) break
    }

    setCachedSuggestions(cacheKey, suggestions)
    const payload: CityAutocompleteResponse = { suggestions }
    return NextResponse.json(payload)
  } catch {
    const payload: CityAutocompleteResponse = { suggestions: [], fallback: true, reason: "provider_error" }
    return NextResponse.json(payload, { status: 200 })
  }
}

