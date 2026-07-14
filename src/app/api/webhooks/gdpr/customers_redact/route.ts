import { NextResponse, after, type NextRequest } from "next/server"
import { handleShopifyCustomerRedact } from "@/lib/shopify-compliance"
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
 * Shopify GDPR mandatory webhook: customers/redact
 * POST /api/webhooks/gdpr/customers_redact
 *
 * OriginPass does not persist Shopify customer PII — handler is a compliant no-op.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateShopifyWebhookRequest(request)
  if (!auth.ok) return auth.response

  const context = parseShopifyWebhookContext(request, auth.rawBody)
  if (context instanceof NextResponse) return context

  // Ack-first: HMAC verified above; the wipe runs after the 200 via `after`.
  after(async () => {
    try {
      await handleShopifyCustomerRedact(
        context.shop,
        readShopifyShopId(context.payload),
        readCustomerId(context.payload),
      )
    } catch (err) {
      console.error(
        "[webhooks/gdpr/customers_redact] handler error:",
        err instanceof Error ? err.message : err,
      )
    }
  })

  return shopifyWebhookAck()
}
