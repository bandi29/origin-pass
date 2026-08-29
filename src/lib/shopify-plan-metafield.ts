/**
 * Sync active OriginPass plan handle → shop metafield so Theme App Extensions
 * (DPP badge) can enforce Scale-only customization on the storefront.
 */

import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { isValidShopDomain, SHOPIFY_API_VERSION } from "@/lib/shopify"
import type { PlanHandle } from "@/lib/shopify-billing"

export const PLAN_METAFIELD_NAMESPACE = "$app"
export const PLAN_METAFIELD_KEY = "plan_handle"

type GraphqlError = { message?: string }

async function shopifyAdminGraphql<T>(
  shop: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Best-effort write of `shop.metafields.app.plan_handle`.
 * Never throws — billing webhook must not fail because of metafield sync.
 */
export async function syncShopPlanMetafield(shop: string, plan: PlanHandle): Promise<void> {
  if (!isValidShopDomain(shop)) return
  const token = await getShopifyAdminToken(shop)
  if (!token) return

  const shopJson = await shopifyAdminGraphql<{
    errors?: GraphqlError[]
    data?: { shop?: { id?: string } | null }
  }>(shop, token, `query { shop { id } }`)

  const shopId = shopJson?.data?.shop?.id
  if (!shopId) return

  const setJson = await shopifyAdminGraphql<{
    errors?: GraphqlError[]
    data?: {
      metafieldsSet?: {
        userErrors?: Array<{ message?: string }>
      }
    }
  }>(
    shop,
    token,
    /* GraphQL */ `
      mutation SetPlanMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { message }
        }
      }
    `,
    {
      metafields: [
        {
          ownerId: shopId,
          namespace: PLAN_METAFIELD_NAMESPACE,
          key: PLAN_METAFIELD_KEY,
          type: "single_line_text_field",
          value: plan,
        },
      ],
    },
  )

  const errs = [
    ...(setJson?.errors ?? []).map((e) => e.message),
    ...(setJson?.data?.metafieldsSet?.userErrors ?? []).map((e) => e.message),
  ].filter(Boolean)
  if (errs.length) {
    console.error(`[shopify-plan-metafield] ${shop}: ${errs.join("; ")}`)
  }
}

export function scheduleShopPlanMetafieldSync(shop: string, plan: PlanHandle): void {
  void syncShopPlanMetafield(shop, plan).catch((e) => {
    console.error("[shopify-plan-metafield] unexpected:", e)
  })
}
