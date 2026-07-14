import type { NextRequest } from "next/server"
import { isValidShopDomain, verifyShopifySessionToken } from "@/lib/shopify"

/**
 * Resolve the authenticated shop for an embedded-app HTTP request.
 *
 * The verified App Bridge session token (Authorization: Bearer …) is
 * authoritative. In dev (no token) we fall back to the `shop` query param so
 * `shopify app dev` works locally; in production a missing/invalid token fails.
 */
export function resolveEmbeddedRequestShop(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  const shopParam = request.nextUrl.searchParams.get("shop")

  const verified = verifyShopifySessionToken(token)
  if (token && !verified) return null
  const shop = verified?.shop ?? (process.env.NODE_ENV === "production" ? "" : shopParam ?? "")
  return isValidShopDomain(shop) ? shop : null
}
