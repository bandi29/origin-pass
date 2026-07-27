import type { NextRequest } from "next/server"

/**
 * Public origin for requests that arrive via a reverse proxy / Cloudflare tunnel.
 *
 * Shopify `shopify:dev` forwards `*.trycloudflare.com` to `localhost:3000`, so
 * `request.nextUrl.origin` is often loopback even when the browser is on the tunnel.
 * Prefer `x-forwarded-host` + `x-forwarded-proto` when present.
 */
export function resolvePublicRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  if (forwardedHost) {
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : forwardedHost.includes("localhost") || forwardedHost.startsWith("127.")
          ? "http"
          : "https"
    return `${proto}://${forwardedHost}`
  }
  return request.nextUrl.origin
}

/** Full public href (origin + path + query) for the current request. */
export function resolvePublicRequestHref(request: NextRequest): string {
  return `${resolvePublicRequestOrigin(request)}${request.nextUrl.pathname}${request.nextUrl.search}`
}

/**
 * Build an absolute URL for redirects/links using the public (forwarded) origin.
 * Prefer {@link relativeRedirectLocation} for browser 307s behind tunnels.
 */
export function publicAbsoluteUrl(request: NextRequest, pathWithOptionalQuery: string): URL {
  return new URL(pathWithOptionalQuery, resolvePublicRequestOrigin(request))
}

/** Path + query only - keeps the browser on the same host (tunnel / prod / localhost). */
export function relativeRedirectLocation(pathWithOptionalQuery: string): string {
  const url = new URL(pathWithOptionalQuery, "http://originpass.local")
  return `${url.pathname}${url.search}`
}
