import { NextResponse, type NextRequest } from "next/server"
import { resolveEmbeddedRequestShop } from "@/lib/shopify-embedded-request-auth"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { buildShopifyEmbeddedAppReturnUrl } from "@/lib/shopify"
import {
  cancelAppSubscription,
  createSubscriptionConfirmationUrl,
  getTrackedSubscriptionId,
  isPaidPlan,
  PAID_PLANS,
  switchPaidPlan,
} from "@/lib/shopify-billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type BillingAction = "upgrade" | "cancel" | "switch"

function parseAction(raw: unknown): BillingAction {
  if (raw === "cancel" || raw === "switch" || raw === "upgrade") return raw
  // Backward compatible: older clients sent only `{ plan }` for upgrades.
  return "upgrade"
}

/**
 * POST /api/shopify/billing — manage Shopify Billing for the embedded admin.
 *
 * Body:
 * - `{ action: "upgrade", plan }` — create recurring charge → confirmationUrl
 * - `{ action: "cancel" }` — appSubscriptionCancel on tracked GID
 * - `{ action: "switch", plan }` — cancel current then create new charge
 *
 * Tier flags flip only via `app_subscriptions/update` webhook — never here.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const shop = resolveEmbeddedRequestShop(request)
  if (!shop) {
    return NextResponse.json({ ok: false, message: "Session expired — reopen the app and retry." }, { status: 401 })
  }

  let body: { action?: unknown; plan?: unknown }
  try {
    body = (await request.json()) as { action?: unknown; plan?: unknown }
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 })
  }

  const action = parseAction(body.action)

  const adminToken = await getShopifyAdminToken(shop)
  if (!adminToken) {
    return NextResponse.json({ ok: false, message: "Connect the store before managing billing." }, { status: 409 })
  }

  const host = request.nextUrl.searchParams.get("host") ?? ""
  const returnUrl =
    buildShopifyEmbeddedAppReturnUrl(shop, host) ?? `https://${shop}/admin/apps`

  if (action === "cancel") {
    const subscriptionId = await getTrackedSubscriptionId(shop)
    if (!subscriptionId) {
      return NextResponse.json({ ok: false, message: "No active paid plan to cancel." }, { status: 409 })
    }
    const result = await cancelAppSubscription({ shop, adminToken, subscriptionId })
    if ("error" in result) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 502 })
    }
    return NextResponse.json({
      ok: true,
      action: "cancel",
      status: result.status,
      message: "Cancellation requested. Your plan returns to Free after Shopify confirms.",
    })
  }

  if (!isPaidPlan(body.plan)) {
    return NextResponse.json({ ok: false, message: "Unknown plan." }, { status: 400 })
  }

  if (action === "switch") {
    const result = await switchPaidPlan({
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
      action: "switch",
      plan: body.plan,
      price: PAID_PLANS[body.plan].price,
      confirmationUrl: result.confirmationUrl,
    })
  }

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
    action: "upgrade",
    plan: body.plan,
    price: PAID_PLANS[body.plan].price,
    confirmationUrl: result.confirmationUrl,
  })
}
