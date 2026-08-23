import { NextResponse, type NextRequest } from "next/server"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { isValidShopDomain, verifyShopifySessionToken } from "@/lib/shopify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/shopify/connection-status?shop=...
 *
 * Validates a usable Admin API token (refreshing when near expiry). A stale row
 * with an expired/revoked grant must report connected:false so the embed can
 * start a fresh OAuth instead of looking "linked" while every Admin call fails.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const shopParam = (request.nextUrl.searchParams.get("shop") ?? "").trim()
  const auth = request.headers.get("authorization")
  const sessionToken = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined
  const verified = sessionToken ? verifyShopifySessionToken(sessionToken) : null
  const shop = (verified?.shop ?? shopParam).trim()

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ ok: false, connected: false, message: "Invalid shop." }, { status: 400 })
  }

  try {
    const token = await getShopifyAdminToken(shop)
    return NextResponse.json({ ok: true, connected: Boolean(token), shop })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed."
    console.error("[shopify/connection-status] failed:", message)
    return NextResponse.json({ ok: false, connected: false, message: "Lookup failed." }, { status: 500 })
  }
}
