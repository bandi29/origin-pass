import { NextResponse, type NextRequest } from "next/server"
import { handleShopifyAppUninstalled } from "@/lib/shopify-compliance"
import {
  authenticateShopifyWebhookRequest,
  parseShopifyWebhookContext,
  readShopifyShopId,
  shopifyWebhookAck,
} from "@/lib/shopify-webhook-handler"

export const dynamic = "force-dynamic"

/**
 * Shopify App Store mandatory webhook: app/uninstalled
 * POST /api/webhooks/app/uninstalled
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateShopifyWebhookRequest(request)
  if (!auth.ok) return auth.response

  const context = parseShopifyWebhookContext(request, auth.rawBody)
  if (context instanceof NextResponse) return context

  try {
    await handleShopifyAppUninstalled(context.shop, readShopifyShopId(context.payload))
  } catch (err) {
    console.error(
      "[webhooks/app/uninstalled] handler error:",
      err instanceof Error ? err.message : err,
    )
  }

  return shopifyWebhookAck()
}
