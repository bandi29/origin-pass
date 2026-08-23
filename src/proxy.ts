import createMiddleware from "next-intl/middleware"
import { type NextRequest, NextResponse } from "next/server"
import { isShopifyEmbeddedEntryQuery } from "./lib/shopify-embedded-health"
import { routing } from "./i18n/routing"
import { PUBLIC_PASSPORT_CACHE_CONTROL } from "./lib/public-shop-passport-data"

const intlMiddleware = createMiddleware(routing)

/** Shopify admin embeds load application_url (tunnel root) with ?embedded=1&shop=…&host=… */
function isShopifyEmbeddedRequest(request: NextRequest): boolean {
  return isShopifyEmbeddedEntryQuery(request.nextUrl.searchParams)
}

/** Shopify admin iframe — allow embedding and drop SAMEORIGIN on rewritten embed entry. */
function withShopifyEmbedHeaders(response: NextResponse): NextResponse {
  response.headers.delete("X-Frame-Options")
  response.headers.set(
    "Content-Security-Policy",
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com https://*.shopify.com https://*.shopify.io;",
  )
  return response
}

/** Tag HTML responses so the root layout can inject App Bridge before Next.js scripts. */
function withShopifyEmbeddedRequest(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-shopify-embedded", "1")
  if (request.nextUrl.searchParams.get("host")) {
    requestHeaders.set("x-shopify-app-bridge", "1")
  }
  return requestHeaders
}

/** Public QR passport HTML — SWR at browser + CDN (overrides Next private no-store). */
function withPublicPassportCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", PUBLIC_PASSPORT_CACHE_CONTROL)
  response.headers.set("CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  response.headers.set("Vercel-CDN-Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  return response
}

const LOCALE_PREFIX = /^\/(en|fr|it)(\/.*)?$/
/** Public consumer passport + GS1 Digital Link entry — never locale-prefix these. */
const PUBLIC_PASSPORT_PATH = /^\/(sp|shop|01)(\/|$)/

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isShopifyPath = pathname.startsWith("/api/shopify")
  const isEmbedEntry = isShopifyEmbeddedRequest(request)

  // English SEO blog — keep unprefixed /blog URLs out of next-intl locale routing.
  if (pathname === "/blog" || pathname.startsWith("/blog/")) {
    return NextResponse.next()
  }

  // Public consumer passports / GS1 Digital Links — apply SWR Cache-Control
  // (Next RSC otherwise emits no-store) and skip next-intl locale redirects.
  // Intentionally do NOT strip X-Frame-Options: these pages must open top-level / new tab
  // (see openOutsideShopifyEmbed). Loading them inside Admin causes "refused to connect".
  if (PUBLIC_PASSPORT_PATH.test(pathname)) {
    return withPublicPassportCacheHeaders(NextResponse.next())
  }

  // `/en?shop=…` from next-intl must not pick up X-Frame-Options: SAMEORIGIN in the iframe.
  if (isEmbedEntry && !isShopifyPath && LOCALE_PREFIX.test(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/api/shopify"
    return withShopifyEmbedHeaders(
      NextResponse.rewrite(url, {
        request: { headers: withShopifyEmbeddedRequest(request) },
      }),
    )
  }

  if (isEmbedEntry && !isShopifyPath) {
    const productMatch = pathname.match(/^\/products\/([^/]+)$/)
    if (productMatch) {
      const url = request.nextUrl.clone()
      url.pathname = `/api/shopify/products/${productMatch[1]}`
      const response = NextResponse.rewrite(url, {
        request: { headers: withShopifyEmbeddedRequest(request) },
      })
      return withShopifyEmbedHeaders(response)
    }

    const url = request.nextUrl.clone()
    url.pathname = "/api/shopify"
    const response = NextResponse.rewrite(url, {
      request: { headers: withShopifyEmbeddedRequest(request) },
    })
    // Rewrite (not redirect) so the iframe never sees X-Frame-Options: SAMEORIGIN on `/`.
    return withShopifyEmbedHeaders(response)
  }

  if (isShopifyPath) {
    // Always stamp Shopify frame-ancestors on embed API routes so a future
    // next.config regression cannot reintroduce X-Frame-Options: SAMEORIGIN.
    return withShopifyEmbedHeaders(
      NextResponse.next({
        request: { headers: withShopifyEmbeddedRequest(request) },
      }),
    )
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: [
    "/",
    "/products/:path*",
    "/api/shopify",
    "/api/shopify/:path*",
    "/sp/:path*",
    "/shop/:path*",
    "/01/:path*",
    "/(fr|en|it)/:path*",
    // Exclude GS1 Digital Link `/01/*` and the English SEO pages (`/blog/*`,
    // `/dpp-checklist`) from locale middleware — they live outside [locale] so
    // their canonical URLs must not be rewritten to `/en/...`.
    "/((?!_next|_vercel|api|p|s|sp|01|blog|dpp-checklist|scan|auth|passports|scans|verifications|analytics|shop|.*\\..*).*)",
  ],
}
