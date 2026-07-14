import { NextResponse, after, type NextRequest } from "next/server"
import { handleShopifyCustomerDataRequest } from "@/lib/shopify-compliance"
import {
  authenticateShopifyWebhookRequest,
  parseShopifyWebhookContext,
  readShopifyShopId,
  shopifyWebhookAck,
} from "@/lib/shopify-webhook-handler"

export const dynamic = "force-dynamic"

function readCustomerId(payload: Record<string, unknown>): number | null {
  const customer = payload.customer
  if (!customer || typeof customer !== "object") return null
  const id = (customer as { id?: unknown }).id
  if (typeof id === "number" && Number.isFinite(id)) return id
  if (typeof id === "string" && /^\d+$/.test(id)) return Number(id)
  return null
}

/**
 * Shopify GDPR mandatory webhook: customers/data_request
 * POST /api/webhooks/gdpr/customers_data_request
 *
 * OriginPass does not persist Shopify customer PII — handler logs and acknowledges.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateShopifyWebhookRequest(request)
  if (!auth.ok) return auth.response

  const context = parseShopifyWebhookContext(request, auth.rawBody)
  if (context instanceof NextResponse) return context

  // Ack-first: HMAC verified above; the export runs after the 200 via `after`.
  after(async () => {
    try {
      await handleShopifyCustomerDataRequest(
        context.shop,
        readShopifyShopId(context.payload),
        readCustomerId(context.payload),
      )
    } catch (err) {
      console.error(
        "[webhooks/gdpr/customers_data_request] handler error:",
        err instanceof Error ? err.message : err,
      )
    }
  })

  return shopifyWebhookAck()
}
