import { NextResponse } from "next/server"
import {
  loadPublicShopPassportData,
  PUBLIC_PASSPORT_CACHE_CONTROL,
} from "@/lib/public-shop-passport-data"

export const runtime = "nodejs"
export const revalidate = 60

type Ctx = { params: Promise<{ shopSlug: string; productId: string }> }

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Access-Control-Max-Age": "86400",
}

function withCors(res: NextResponse) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v)
  }
  return res
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }))
}

/**
 * Lightweight storefront summary for the OriginPass theme app block modal.
 * CORS-open so Shopify storefront JS can fetch without iframe (public /sp pages
 * intentionally set X-Frame-Options: SAMEORIGIN).
 */
export async function GET(req: Request, ctx: Ctx) {
  const { shopSlug, productId } = await ctx.params
  const url = new URL(req.url)
  const variantId = url.searchParams.get("variant")

  const data = await loadPublicShopPassportData({
    shopId: shopSlug,
    productId,
    variantId,
  })

  const body = {
    productTitle: data.productTitle,
    brandName: data.brandName,
    imageUrl: data.imageUrl,
    story: data.story,
    materials: data.materials,
    productionLocation: data.productionLocation,
    careInstructions: data.careInstructions,
    passportPath: `/sp/${encodeURIComponent(shopSlug)}/${encodeURIComponent(productId)}`,
    dataLevel: data.dataLevel,
  }

  const res = NextResponse.json(body, {
    headers: {
      "Cache-Control": PUBLIC_PASSPORT_CACHE_CONTROL,
      "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
  return withCors(res)
}
