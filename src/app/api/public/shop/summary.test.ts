import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, OPTIONS } from "@/app/api/public/shop/[shopSlug]/[productId]/summary/route"
import { loadPublicShopPassportData } from "@/lib/public-shop-passport-data"

vi.mock("@/lib/public-shop-passport-data", () => ({
  loadPublicShopPassportData: vi.fn(),
  PUBLIC_PASSPORT_CACHE_CONTROL:
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
}))

describe("public shop passport summary (functional)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadPublicShopPassportData).mockResolvedValue({
      productTitle: "Organic Tee",
      imageUrl: "https://cdn.example/tee.jpg",
      brandName: "OriginPass Sandbox",
      productionLocation: "Portugal",
      careInstructions: "Cold wash",
      story: "Made with care",
      materials: "100% organic cotton",
      materialComposition: { "Organic cotton": 100 },
      carbonFootprint: null,
      dataLevel: "product",
      dataProvenance: "record",
      evidence: undefined,
    })
  })

  it("SUM-01: returns CORS-open JSON summary for storefront modal", async () => {
    const response = await GET(
      new Request("http://localhost/api/public/shop/originpass-sandbox/42/summary"),
      { params: Promise.resolve({ shopSlug: "originpass-sandbox", productId: "42" }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Cache-Control")).toContain("public")

    const body = (await response.json()) as {
      productTitle?: string
      brandName?: string
      story?: string
      materials?: string
      productionLocation?: string
      careInstructions?: string
      passportPath?: string
    }

    expect(body.productTitle).toBe("Organic Tee")
    expect(body.brandName).toBe("OriginPass Sandbox")
    expect(body.story).toBe("Made with care")
    expect(body.materials).toBe("100% organic cotton")
    expect(body.productionLocation).toBe("Portugal")
    expect(body.careInstructions).toBe("Cold wash")
    expect(body.passportPath).toBe("/sp/originpass-sandbox/42")

    expect(loadPublicShopPassportData).toHaveBeenCalledWith({
      shopId: "originpass-sandbox",
      productId: "42",
      variantId: null,
    })
  })

  it("SUM-02: forwards optional variant query to data loader", async () => {
    await GET(
      new Request(
        "http://localhost/api/public/shop/originpass-sandbox/42/summary?variant=991",
      ),
      { params: Promise.resolve({ shopSlug: "originpass-sandbox", productId: "42" }) },
    )

    expect(loadPublicShopPassportData).toHaveBeenCalledWith({
      shopId: "originpass-sandbox",
      productId: "42",
      variantId: "991",
    })
  })

  it("SUM-03: OPTIONS preflight returns 204 with CORS headers", async () => {
    const response = await OPTIONS()
    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET")
  })
})
