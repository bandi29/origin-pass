import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { loadEnvLocalIntoProcess } from "./src/lib/env-local-file"

const withNextIntl = createNextIntlPlugin()

loadEnvLocalIntoProcess()

/** 8 MiB — Next 16 types `bodySizeLimit` as byte count (number), not string. */
const EIGHT_MB = 8 * 1024 * 1024

const nextConfig: NextConfig = {
  // Shopify CLI tunnels (Cloudflare) load the app from *.trycloudflare.com while
  // assets are served from localhost — allow those origins in dev or the iframe goes blank.
  allowedDevOrigins: ["*.trycloudflare.com", "*.cloudflare.com"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Hide the floating Next.js dev badge (the "N" logo in the bottom-left during `npm run dev`).
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: EIGHT_MB,
    },
    // Dashboard pages are dynamic (per-user, per-request data). The App Router's
    // client router cache can otherwise serve a stale RSC payload after a <Link>
    // navigation — e.g. clicking "Verification" while on the Fraud Analytics tab
    // could keep showing the previous segment. Setting the dynamic stale time to 0
    // forces a fresh fetch on every navigation so the content always matches the URL.
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
  async redirects() {
    return [
      {
        source: "/:locale/dashboard/passports",
        destination: "/:locale/dashboard/product-passports",
        permanent: true,
      },
      {
        source: "/:locale/dashboard/passports",
        destination: "/:locale/dashboard/product-passports",
        permanent: true,
      },
      {
        source: "/:locale/dashboard/passports/:path*",
        destination: "/:locale/dashboard/product-passports/:path*",
        permanent: true,
      },
      {
        source: "/:locale/product",
        destination: "/:locale/dashboard/product-identity",
        permanent: true,
      },
      {
        source: "/:locale/product/:path*",
        destination: "/:locale/dashboard/product-identity/:path*",
        permanent: true,
      },
      {
        source: "/:locale/dashboard/qr-identity/generate",
        destination: "/:locale/dashboard/qr-identity/all",
        permanent: true,
      },
      {
        source: "/:locale/dashboard/product-identity/qr-identity/generate",
        destination: "/:locale/dashboard/qr-identity/all",
        permanent: true,
      },
    ]
  },
  async headers() {
    const baseSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()" },
    ]
    if (process.env.NODE_ENV === "production") {
      baseSecurityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      })
    }
    const shopifyEmbedHeaders = [
      ...baseSecurityHeaders,
      {
        key: "Content-Security-Policy",
        value:
          "frame-ancestors https://admin.shopify.com https://*.myshopify.com https://*.shopify.com https://*.shopify.io;",
      },
    ]
    return [
      {
        // Embedded Shopify admin iframe — must NOT send X-Frame-Options: SAMEORIGIN.
        source: "/api/shopify",
        headers: shopifyEmbedHeaders,
      },
      {
        source: "/api/shopify/:path*",
        headers: shopifyEmbedHeaders,
      },
      {
        // Shopify admin loads application_url root (`/?embedded=1&shop=…`), rewritten to
        // /api/shopify by proxy.ts. Do NOT send X-Frame-Options here or the iframe is blank.
        source: "/",
        headers: shopifyEmbedHeaders,
      },
      {
        // Embedded product editor — rewritten from /products/:id in proxy.ts.
        source: "/products/:path*",
        headers: shopifyEmbedHeaders,
      },
      {
        // next-intl locale roots/paths — proxy rewrites embed requests with ?shop= to /api/shopify.
        // Must not send X-Frame-Options: SAMEORIGIN or the Shopify iframe goes blank.
        source: "/en",
        headers: shopifyEmbedHeaders,
      },
      {
        source: "/en/:path*",
        headers: shopifyEmbedHeaders,
      },
      {
        source: "/fr",
        headers: shopifyEmbedHeaders,
      },
      {
        source: "/fr/:path*",
        headers: shopifyEmbedHeaders,
      },
      {
        source: "/it",
        headers: shopifyEmbedHeaders,
      },
      {
        source: "/it/:path*",
        headers: shopifyEmbedHeaders,
      },
      {
        // Public QR / consumer passports — SWR at the edge (Vercel CDN / shared caches).
        // Browser: 60s · CDN: 5m · serve stale while revalidating for 10m.
        // Keep SAMEORIGIN: these pages must open top-level / new tab (not inside the
        // Shopify admin iframe). "View passport" uses target=_blank for that reason.
        source: "/sp/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/shop/:path*",
        headers: [
          ...baseSecurityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
          { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
      {
        // Require at least one path segment so `/` is handled above, not here.
        // Exclude public passport paths (handled above with SWR Cache-Control).
        source: "/((?!api/shopify|en|fr|it|products|sp|shop).+)",
        headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
