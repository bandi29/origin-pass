import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { isValidShopDomain, verifyShopifySessionToken } from "@/lib/shopify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/shopify/connection-status?shop=...
 *
 * Lightweight offline-token presence check for the embedded home gate.
 * Prefer this over the isStoreConnected Server Action when the app is loaded
 * through a Cloudflare quick tunnel -- Server Actions can fail CSRF/origin checks
 * and leave the UI stuck on "Connecting..." / OAuth-looping even when a grant exists.
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
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("organizations")
      .select("shopify_access_token")
      .eq("shop_domain", shop)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, connected: false, message: "Lookup failed." }, { status: 500 })
    }

    const connected = Boolean(
      (data as { shopify_access_token?: string | null } | null)?.shopify_access_token,
    )
    return NextResponse.json({ ok: true, connected, shop })
  } catch {
    return NextResponse.json({ ok: false, connected: false, message: "Lookup failed." }, { status: 500 })
  }
}
