import { NextResponse, type NextRequest } from "next/server"
import { resolveEmbeddedRequestShop } from "@/lib/shopify-embedded-request-auth"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { buildShopifyEmbeddedAppReturnUrl } from "@/lib/shopify"
import { createSubscriptionConfirmationUrl, isPaidPlan, PAID_PLANS } from "@/lib/shopify-billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/shopify/billing — start a tier upgrade.
 *
 * Body: { plan: "grower" | "enterprise" }. Creates the recurring charge via the
 * Admin GraphQL Billing API and returns Shopify's confirmationUrl; the client
 * redirects the TOP window there. The tier flag itself is only flipped by the
 * app_subscriptions/update webhook once the merchant approves — never here.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const shop = resolveEmbeddedRequestShop(request)
  if (!shop) {
    return NextResponse.json({ ok: false, message: "Session expired — reopen the app and retry." }, { status: 401 })
  }

  let body: { plan?: unknown }
  try {
    body = (await request.json()) as { plan?: unknown }
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 })
  }
  if (!isPaidPlan(body.plan)) {
    return NextResponse.json({ ok: false, message: "Unknown plan." }, { status: 400 })
  }

  const adminToken = await getShopifyAdminToken(shop)
  if (!adminToken) {
    return NextResponse.json({ ok: false, message: "Connect the store before upgrading." }, { status: 409 })
  }

  const host = request.nextUrl.searchParams.get("host") ?? ""
  const returnUrl =
    buildShopifyEmbeddedAppReturnUrl(shop, host) ?? `https://${shop}/admin/apps`

  const result = await createSubscriptionConfirmationUrl({
    shop,
    adminToken,
    plan: body.plan,
    returnUrl,
  })

  if ("error" in result) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    plan: body.plan,
    price: PAID_PLANS[body.plan].price,
    confirmationUrl: result.confirmationUrl,
  })
}
