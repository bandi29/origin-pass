import { NextResponse } from "next/server"

/** Nominatim policy: identify the application with a stable User-Agent string. */
const NOMINATIM_USER_AGENT = "OriginPass-Compliance-App"

type NominatimRow = {
  lat?: string
  lon?: string
  display_name?: string
}

export type NominatimSuggestion = {
  display_name: string
  lat: string
  lon: string
}

/**
 * Returns up to 5 Nominatim search results for inline autocomplete (server-side fetch = valid User-Agent).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (q.length < 3) {
    return NextResponse.json({ suggestions: [] as NominatimSuggestion[] })
  }
  if (q.length > 240) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 })
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search")
  nominatimUrl.searchParams.set("q", q)
  nominatimUrl.searchParams.set("format", "json")
  nominatimUrl.searchParams.set("addressdetails", "1")
  nominatimUrl.searchParams.set("limit", "5")

  try {
    const res = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] as NominatimSuggestion[], error: "Upstream error" }, { status: 502 })
    }

    const data = (await res.json()) as NominatimRow[]
    if (!Array.isArray(data)) {
      return NextResponse.json({ suggestions: [] as NominatimSuggestion[] })
    }

    const suggestions: NominatimSuggestion[] = data
      .filter((row) => row.lat && row.lon && row.display_name)
      .map((row) => {
        const lat = parseFloat(String(row.lat))
        const lon = parseFloat(String(row.lon))
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return null
        }
        return {
          display_name: String(row.display_name),
          lat: String(row.lat),
          lon: String(row.lon),
        }
      })
      .filter((x): x is NominatimSuggestion => x != null)

    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: [] as NominatimSuggestion[], error: "Request failed" }, { status: 502 })
  }
}
