import { NextResponse, type NextRequest } from "next/server"
import { applySubscriptionWebhook } from "@/lib/shopify-billing"
import { archiveShopifyProduct, clearShopifyToken, upsertShopifyProduct } from "@/lib/shopify-sync"
import {
  authenticateShopifyWebhookRequest,
  parseShopifyWebhookContext,
  shopifyWebhookAck,
} from "@/lib/shopify-webhook-handler"

export const dynamic = "force-dynamic"

/**
 * Single Shopify webhook receiver.
 *
 * Verifies the raw-body HMAC via `authenticateShopifyWebhookRequest`, then
 * dispatches by `X-Shopify-Topic`. Always returns 2xx once authenticated so
 * Shopify doesn't retry on app-side errors (we log + swallow those). 401 only
 * for failed/missing authentication.
 *
 * Register product topics against `${APP_URL}/api/shopify/webhooks`.
 * Compliance topics (app/uninstalled, GDPR) live under `/api/webhooks/*`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateShopifyWebhookRequest(request)
  if (!auth.ok) return auth.response

  const context = parseShopifyWebhookContext(request, auth.rawBody)
  if (context instanceof NextResponse) return context

  const { shop, topic, payload } = context

  try {
    switch (topic) {
      case "products/create":
      case "products/update":
        await upsertShopifyProduct(shop, payload)
        break
      case "products/delete":
        if (payload.id != null) await archiveShopifyProduct(shop, payload.id as string | number)
        break
      case "app/uninstalled":
        // Legacy path — canonical handler is POST /api/webhooks/app/uninstalled.
        await clearShopifyToken(shop)
        break
      case "app_subscriptions/update":
        // Merchant approved / cancelled a recurring charge — sync the tier flag.
        // (Shopify has no separate "approve" topic; approval = status ACTIVE here.)
        await applySubscriptionWebhook(shop, payload)
        break
      default:
        break
    }
  } catch (err) {
    console.error(`[shopify/webhooks] ${topic} failed:`, err instanceof Error ? err.message : err)
  }

  return shopifyWebhookAck()
}
