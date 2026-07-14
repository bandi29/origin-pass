import { NextResponse } from "next/server"

const UA = "OriginPass-Compliance-App"

/**
 * Proxies OpenStreetMap Nominatim search (free, no API key).
 * @see https://nominatim.org/release-docs/develop/api/Search/
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""
  if (!q || q.length > 240) {
    return NextResponse.json({ error: "Provide a non-empty address under 240 characters." }, { status: 400 })
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search")
  nominatimUrl.searchParams.set("format", "json")
  nominatimUrl.searchParams.set("limit", "1")
  nominatimUrl.searchParams.set("q", q)

  try {
    const res = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
      },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding service temporarily unavailable." },
        { status: 502 },
      )
    }

    const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
    const hit = data[0]
    if (!hit?.lat || !hit?.lon) {
      return NextResponse.json({ error: "No results for that query. Try a nearby city or region." }, { status: 404 })
    }

    const lat = parseFloat(hit.lat)
    const lng = parseFloat(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Invalid coordinates returned." }, { status: 502 })
    }

    return NextResponse.json({
      lat,
      lng,
      displayName: hit.display_name ?? null,
    })
  } catch {
    return NextResponse.json({ error: "Geocoding request failed." }, { status: 502 })
  }
}
