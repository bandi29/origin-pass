import { NextResponse, type NextRequest } from "next/server"
import { getShopifyApiSecret, isValidShopDomain, verifyShopifyWebhook } from "@/lib/shopify"

export type ShopifyWebhookContext = {
  rawBody: string
  shop: string
  topic: string
  payload: Record<string, unknown>
}

export type ShopifyWebhookAuthResult =
  | { ok: true; rawBody: string }
  | { ok: false; response: NextResponse }

/**
 * Read the raw body and verify `X-Shopify-Hmac-Sha256` before JSON parsing.
 * Must be called once per request — the body stream is consumed here.
 */
export async function authenticateShopifyWebhookRequest(
  request: NextRequest,
): Promise<ShopifyWebhookAuthResult> {
  const rawBody = await request.text()
  const hmac = request.headers.get("x-shopify-hmac-sha256")

  if (!getShopifyApiSecret()) {
    console.error("[shopify/webhook] SHOPIFY_API_SECRET (or SHOPIFY_API_SECRET_KEY) is not configured")
    return {
      ok: false,
      response: NextResponse.json({ error: "Server misconfigured." }, { status: 500 }),
    }
  }

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 }),
    }
  }

  return { ok: true, rawBody }
}

/** Parse JSON and resolve shop domain from header or payload (GDPR webhooks). */
export function parseShopifyWebhookContext(
  request: NextRequest,
  rawBody: string,
): ShopifyWebhookContext | NextResponse {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const headerShop = request.headers.get("x-shopify-shop-domain")
  const payloadShop =
    typeof payload.shop_domain === "string"
      ? payload.shop_domain
      : typeof payload.myshopify_domain === "string"
        ? payload.myshopify_domain
        : null

  const shop = headerShop ?? payloadShop ?? ""
  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid shop domain." }, { status: 400 })
  }

  const topic = request.headers.get("x-shopify-topic") ?? ""

  return { rawBody, shop, topic, payload }
}

export function shopifyWebhookAck(): NextResponse {
  return NextResponse.json({ received: true }, { status: 200 })
}

/** Extract numeric Shopify shop id when present in webhook payloads. */
export function readShopifyShopId(payload: Record<string, unknown>): number | null {
  const raw = payload.shop_id
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw)
  return null
}
