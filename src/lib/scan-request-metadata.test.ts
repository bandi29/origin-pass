import { describe, expect, it } from "vitest"
import {
  UNKNOWN_LOCATION,
  extractScanRequestMetadata,
  formatScanLocationLabel,
} from "@/lib/scan-request-metadata"

describe("extractScanRequestMetadata", () => {
  it("reads trusted edge headers", () => {
    const request = new Request("https://originpass.test/scan/uuid", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.10",
        "user-agent": "Mozilla/5.0",
        "x-vercel-ip-country": "US",
        "x-vercel-ip-country-region": "CA",
        "x-vercel-ip-city": "San%20Francisco",
      },
    })

    const meta = extractScanRequestMetadata(request)
    expect(meta.ipAddress).toBe("203.0.113.10")
    expect(meta.userAgent).toBe("Mozilla/5.0")
    expect(meta.country).toBe("US")
    expect(meta.region).toBe("CA")
    expect(meta.city).toBe("San Francisco")
    expect(meta.locationLabel).toBe("San Francisco, CA, US")
  })

  it("falls back to Unknown Location when geo headers are missing", () => {
    const request = new Request("https://originpass.test/scan/uuid")
    const meta = extractScanRequestMetadata(request)
    expect(meta.country).toBe(UNKNOWN_LOCATION)
    expect(meta.locationLabel).toBe(UNKNOWN_LOCATION)
  })
})

describe("formatScanLocationLabel", () => {
  it("joins city, region, and country", () => {
    expect(
      formatScanLocationLabel({ city: "Paris", region: "IDF", country: "FR" }),
    ).toBe("Paris, IDF, FR")
  })
})
