/**
 * Diagnose OriginPass sandbox Admin token (with refresh).
 * Usage: npx tsx --env-file=.env.local scripts/check-shopify-token.ts
 */
import { createClient } from "@supabase/supabase-js"
import { getShopifyAdminToken } from "../src/lib/shopify-admin-token"

const shop = process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing Supabase env")
    process.exit(1)
  }

  const sb = createClient(url, key)
  const { data } = await sb
    .from("organizations")
    .select("shopify_refresh_token, shopify_token_expires_at")
    .eq("shop_domain", shop)
    .maybeSingle()

  console.log("expires_at", data?.shopify_token_expires_at ?? null)
  console.log("has_refresh", Boolean(data?.shopify_refresh_token))

  const token = await getShopifyAdminToken(shop)
  console.log("resolved_token", Boolean(token))
  if (!token) process.exit(2)

  const res = await fetch(`https://${shop}/admin/api/2024-10/products/count.json`, {
    headers: { "X-Shopify-Access-Token": token },
  })
  console.log("api_status", res.status)
  if (!res.ok) {
    console.log("api_error", (await res.text()).slice(0, 200))
    process.exit(1)
  }
  console.log("product_count", (await res.json()).count)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
