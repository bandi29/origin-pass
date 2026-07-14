import { NextResponse, after, type NextRequest } from "next/server"
import { handleShopifyShopRedact } from "@/lib/shopify-compliance"
import {
  authenticateShopifyWebhookRequest,
  parseShopifyWebhookContext,
  readShopifyShopId,
  shopifyWebhookAck,
} from "@/lib/shopify-webhook-handler"

export const dynamic = "force-dynamic"

/**
 * Shopify GDPR mandatory webhook: shop/redact
 * POST /api/webhooks/gdpr/shop_redact
 *
 * Sent 48 hours after uninstall — final purge of merchant store data.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateShopifyWebhookRequest(request)
  if (!auth.ok) return auth.response

  const context = parseShopifyWebhookContext(request, auth.rawBody)
  if (context instanceof NextResponse) return context

  // Ack-first: HMAC is verified above (never deferred). The purge runs AFTER
  // the 200 is sent, via next/server `after` — Shopify's validation sweep gets
  // an immediate response while the platform keeps the worker alive.
  after(async () => {
    try {
      await handleShopifyShopRedact(context.shop, readShopifyShopId(context.payload))
    } catch (err) {
      console.error(
        "[webhooks/gdpr/shop_redact] handler error:",
        err instanceof Error ? err.message : err,
      )
    }
  })

  return shopifyWebhookAck()
}
