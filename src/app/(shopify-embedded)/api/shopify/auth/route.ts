import { NextResponse, type NextRequest } from "next/server"
import { buildShopifyOAuthInstallUrl, buildShopifyOAuthRedirectUri, isValidShopDomain } from "@/lib/shopify"

export const dynamic = "force-dynamic"

/**
 * OAuth install entry — redirects the merchant through Shopify authorize
 * so we receive an offline access token at /api/shopify/auth/callback.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const shop = request.nextUrl.searchParams.get("shop")
  const host = request.nextUrl.searchParams.get("host") ?? ""

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Missing or invalid shop parameter." }, { status: 400 })
  }

  const redirectUri = buildShopifyOAuthRedirectUri(request.nextUrl.origin)
  const authorizeUrl = buildShopifyOAuthInstallUrl(shop, redirectUri)

  if (!authorizeUrl) {
    return NextResponse.json({ error: "Shopify OAuth is not configured." }, { status: 500 })
  }

  const url = new URL(authorizeUrl)
  if (host) url.searchParams.set("state", host)

  return NextResponse.redirect(url)
}
