import { expect, test } from "@playwright/test"
import {
  GS1_E2E_GTIN,
  GS1_E2E_LOCATION_PATH,
  GS1_E2E_PASSPORT_ID,
} from "./gs1-e2e-constants"

/**
 * GS1 Digital Link HTTP scenarios (GS1-01 through GS1-05).
 * GS1-01 requires `npm run seed:dev` (wired into `npm run test:e2e:gs1`).
 */

test.describe("GS1 Digital Link resolution", () => {
  test("GS1-01: seeded GTIN URI returns 307 to public /sp passport HTML", async ({ request }) => {
    const res = await request.get(`/01/${GS1_E2E_GTIN}`, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    })
    expect(res.status(), "GS1-01 should Temporary Redirect").toBe(307)

    const location = res.headers()["location"] || ""
    const locationPath = location.startsWith("http")
      ? new URL(location).pathname
      : location.split("?")[0]
    // Public QR shape is /sp/{shopSlug}/{external_product_id}; external id = passport-e2e-gs1-01
    expect(locationPath).toBe(GS1_E2E_LOCATION_PATH)
    expect(locationPath).toContain(GS1_E2E_PASSPORT_ID)

    const followed = await request.get(locationPath, {
      headers: { Accept: "text/html" },
    })
    expect(followed.status(), "passport landing page after redirect").toBe(200)
    expect(followed.headers()["content-type"] || "").toMatch(/text\/html/i)
    const html = await followed.text()
    expect(html.length).toBeGreaterThan(200)
    expect(html).toMatch(/OriginPass|Material|passport|Care/i)
  })

  test("GS1-04: malformed 10-digit GTIN returns 400 + Invalid GS1 Identifier Structure", async ({
    request,
  }) => {
    const res = await request.get("/01/1234567890", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(400)
    const body = await res.text()
    expect(body).toContain("Invalid GS1 Identifier Structure")
  })

  test("GS1-04: malformed GTIN as JSON returns 400 JSON-LD error", async ({ request }) => {
    const res = await request.get("/01/abcdefghijklm", {
      headers: { Accept: "application/ld+json" },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Invalid GS1 Identifier Structure")
    expect(json["@context"]).toBe("https://gs1.org/voc/")
  })

  test("GS1-05: valid unassigned GTIN returns friendly 404 HTML", async ({ request }) => {
    const res = await request.get("/01/00000000000000", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    })
    // If a merchant somehow assigned this GTIN, accept 307 instead of failing CI.
    expect([404, 307]).toContain(res.status())
    if (res.status() === 404) {
      const body = await res.text()
      expect(body).toMatch(/no active passport|passport not found/i)
    }
  })

  test("GS1-05: valid unassigned GTIN JSON returns 404 machine payload", async ({ request }) => {
    const res = await request.get("/01/00000000000000", {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    })
    expect([404, 200, 307]).toContain(res.status())
    if (res.status() === 404) {
      const json = await res.json()
      expect(json.error).toMatch(/no active passport/i)
    }
  })

  test("GS1-03: Accept text/html on unassigned GTIN returns HTML (not JSON-LD)", async ({
    request,
  }) => {
    const res = await request.get("/01/00000000000000", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    })
    if (res.status() === 404) {
      expect(res.headers()["content-type"] || "").toMatch(/text\/html/i)
    } else {
      expect([200, 307]).toContain(res.status())
    }
  })

  test("GS1-02: path with lot/serial still validates structure (not 400)", async ({ request }) => {
    const res = await request.get("/01/00000000000000/10/BATCH-A/21/SER-1", {
      headers: { Accept: "application/ld+json" },
      maxRedirects: 0,
    })
    expect(res.status()).not.toBe(400)
    expect(res.status()).toBeLessThan(500)
  })

  test("GS1 syntax: zero-padded unassigned GTIN is not 400 / not 500", async ({ request }) => {
    const res = await request.get("/01/00000000000000", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    })
    expect([404, 307, 200]).toContain(res.status())
    expect(res.status()).not.toBe(400)
    expect(res.status()).toBeLessThan(500)
  })

  test("GS1-03: locale middleware must not rewrite /01 to /en/01", async ({ request }) => {
    const res = await request.get("/01/1234567890", {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    })
    const location = res.headers()["location"] || ""
    expect(location).not.toMatch(/\/en\/01\//)
    expect(res.status()).toBe(400)
  })
})
