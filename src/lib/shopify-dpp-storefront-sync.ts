/**
 * Sync OriginPass passport → Shopify storefront metafields / metaobject
 * so the Theme App Extension DPP badge can resolve without hardcoding.
 *
 * Writes (app-owned `$app` namespace, declared in shopify.app.toml):
 *   - metaobject `$app:digital_product_passport` (stable handle per Shopify product)
 *   - product metafield `passport_url` (url)
 *   - product metafield `dpp` (metaobject_reference)
 *
 * Best-effort: never throws to callers; skips non-Shopify products / missing tokens.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { getShopifyAdminToken } from "@/lib/shopify-admin-token"
import { isValidShopDomain, SHOPIFY_API_VERSION } from "@/lib/shopify"
import { buildShopifyPublicPassportUrl } from "@/lib/shopify-public-passport-url"

export const DPP_METAOBJECT_TYPE = "$app:digital_product_passport"
export const DPP_METAFIELD_NAMESPACE = "$app"
export const DPP_METAFIELD_KEY_URL = "passport_url"
export const DPP_METAFIELD_KEY_REF = "dpp"

export type StorefrontDppSyncResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  metaobjectId?: string
  passportUrl?: string
}

type GraphqlError = { message?: string }

type UpsertMetaobjectResponse = {
  errors?: GraphqlError[]
  data?: {
    metaobjectUpsert?: {
      metaobject?: { id?: string; handle?: string } | null
      userErrors?: Array<{ message?: string; code?: string }>
    }
  }
}

type MetafieldsSetResponse = {
  errors?: GraphqlError[]
  data?: {
    metafieldsSet?: {
      metafields?: Array<{ id?: string; key?: string }> | null
      userErrors?: Array<{ message?: string; code?: string }>
    }
  }
}

type MetafieldsDeleteResponse = {
  errors?: GraphqlError[]
  data?: {
    metafieldsDelete?: {
      deletedMetafields?: Array<{ key?: string } | null> | null
      userErrors?: Array<{ message?: string; code?: string }>
    }
  }
}

function publicAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    process.env.SHOPIFY_APP_URL?.replace(/\/$/, "") ||
    "https://origin-pass.vercel.app"
  )
}

/** Stable Shopify metaobject handle for a catalog product (max 255, [a-z0-9-]). */
export function dppMetaobjectHandle(externalProductId: string): string {
  const id = externalProductId.trim().replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()
  return `originpass-product-${id}`.slice(0, 255)
}

export function shopifyProductGid(externalProductId: string): string {
  const id = externalProductId.trim()
  return id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`
}

export function buildStorefrontPassportUrl(shopDomain: string, externalProductId: string): string {
  const built = buildShopifyPublicPassportUrl(shopDomain, externalProductId)
  if (built.startsWith("http://") || built.startsWith("https://")) return built
  return `${publicAppOrigin()}${built.startsWith("/") ? "" : "/"}${built}`
}

async function shopifyAdminGraphql<T>(
  shop: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) {
      console.error(`[shopify-dpp-sync] HTTP ${res.status} for ${shop}`)
      return null
    }
    return (await res.json()) as T
  } catch (e) {
    console.error(`[shopify-dpp-sync] fetch failed for ${shop}:`, e)
    return null
  }
}

const UPSERT_METAOBJECT = /* GraphQL */ `
  mutation OriginPassUpsertDpp($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message code }
    }
  }
`

const SET_METAFIELDS = /* GraphQL */ `
  mutation OriginPassSetDppMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key }
      userErrors { field message code }
    }
  }
`

const DELETE_METAFIELDS = /* GraphQL */ `
  mutation OriginPassDeleteDppMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields { key }
      userErrors { field message code }
    }
  }
`

async function clearProductDppMetafields(
  shop: string,
  token: string,
  productGid: string,
): Promise<StorefrontDppSyncResult> {
  const json = await shopifyAdminGraphql<MetafieldsDeleteResponse>(shop, token, DELETE_METAFIELDS, {
    metafields: [
      { ownerId: productGid, namespace: DPP_METAFIELD_NAMESPACE, key: DPP_METAFIELD_KEY_URL },
      { ownerId: productGid, namespace: DPP_METAFIELD_NAMESPACE, key: DPP_METAFIELD_KEY_REF },
    ],
  })
  if (!json) return { ok: false, reason: "metafieldsDelete_http_failed" }
  const errs = json.data?.metafieldsDelete?.userErrors ?? []
  const top = json.errors ?? []
  if (top.length || errs.length) {
    const msg = [...top.map((e) => e.message), ...errs.map((e) => e.message)].filter(Boolean).join("; ")
    console.error(`[shopify-dpp-sync] metafieldsDelete errors: ${msg}`)
    return { ok: false, reason: msg || "metafieldsDelete_user_errors" }
  }
  return { ok: true, reason: "cleared" }
}

/**
 * Upsert metaobject + product metafields for an OriginPass passport.
 * Call after create / content save / QR mint. Safe to call repeatedly (idempotent).
 */
export async function syncPassportStorefrontMetafields(
  passportId: string,
): Promise<StorefrontDppSyncResult> {
  if (!passportId?.trim()) return { ok: false, skipped: true, reason: "missing_passport_id" }

  const admin = createAdminClient()
  const { data: passport, error: pErr } = await admin
    .from("passports")
    .select(
      "id, status, passport_uid, product_id, product:products(id, name, external_product_id, organization_id)",
    )
    .eq("id", passportId)
    .maybeSingle()

  if (pErr || !passport) {
    return { ok: false, skipped: true, reason: "passport_not_found" }
  }

  const productJoin = passport.product as
    | {
        id?: string
        name?: string | null
        external_product_id?: string | null
        organization_id?: string | null
      }
    | {
        id?: string
        name?: string | null
        external_product_id?: string | null
        organization_id?: string | null
      }[]
    | null

  const product = Array.isArray(productJoin) ? productJoin[0] : productJoin
  const externalProductId = product?.external_product_id?.trim() || ""
  const organizationId = product?.organization_id?.trim() || ""

  if (!externalProductId) {
    return { ok: true, skipped: true, reason: "not_shopify_product" }
  }
  if (!organizationId) {
    return { ok: true, skipped: true, reason: "missing_organization" }
  }

  const { data: org } = await admin
    .from("organizations")
    .select("shop_domain")
    .eq("id", organizationId)
    .maybeSingle()

  const shop = (org as { shop_domain?: string | null } | null)?.shop_domain?.trim() || ""
  if (!isValidShopDomain(shop)) {
    return { ok: true, skipped: true, reason: "no_shop_domain" }
  }

  const token = await getShopifyAdminToken(shop)
  if (!token) {
    return { ok: false, skipped: true, reason: "no_admin_token" }
  }

  const productGid = shopifyProductGid(externalProductId)
  const status = String(passport.status || "active").toLowerCase()

  if (status === "revoked" || status === "expired") {
    return clearProductDppMetafields(shop, token, productGid)
  }

  const passportUrl = buildStorefrontPassportUrl(shop, externalProductId)
  const title = (product?.name || "Digital Product Passport").trim().slice(0, 200) || "Digital Product Passport"
  const handle = dppMetaobjectHandle(externalProductId)

  const upsertJson = await shopifyAdminGraphql<UpsertMetaobjectResponse>(shop, token, UPSERT_METAOBJECT, {
    handle: { type: DPP_METAOBJECT_TYPE, handle },
    metaobject: {
      fields: [
        { key: "title", value: title },
        { key: "passport_url", value: passportUrl },
        { key: "passport_id", value: String(passport.id) },
        { key: "status", value: status || "active" },
      ],
    },
  })

  if (!upsertJson) return { ok: false, reason: "metaobjectUpsert_http_failed" }

  const upsertErrors = upsertJson.data?.metaobjectUpsert?.userErrors ?? []
  const upsertTop = upsertJson.errors ?? []
  const metaobjectId = upsertJson.data?.metaobjectUpsert?.metaobject?.id
  if (upsertTop.length || upsertErrors.length || !metaobjectId) {
    const msg = [
      ...upsertTop.map((e) => e.message),
      ...upsertErrors.map((e) => e.message),
    ]
      .filter(Boolean)
      .join("; ")
    console.error(`[shopify-dpp-sync] metaobjectUpsert errors: ${msg || "missing id"}`)
    return { ok: false, reason: msg || "metaobjectUpsert_failed" }
  }

  const setJson = await shopifyAdminGraphql<MetafieldsSetResponse>(shop, token, SET_METAFIELDS, {
    metafields: [
      {
        ownerId: productGid,
        namespace: DPP_METAFIELD_NAMESPACE,
        key: DPP_METAFIELD_KEY_URL,
        type: "url",
        value: passportUrl,
      },
      {
        ownerId: productGid,
        namespace: DPP_METAFIELD_NAMESPACE,
        key: DPP_METAFIELD_KEY_REF,
        type: "metaobject_reference",
        value: metaobjectId,
      },
    ],
  })

  if (!setJson) return { ok: false, reason: "metafieldsSet_http_failed", metaobjectId, passportUrl }

  const setErrors = setJson.data?.metafieldsSet?.userErrors ?? []
  const setTop = setJson.errors ?? []
  if (setTop.length || setErrors.length) {
    const msg = [...setTop.map((e) => e.message), ...setErrors.map((e) => e.message)]
      .filter(Boolean)
      .join("; ")
    console.error(`[shopify-dpp-sync] metafieldsSet errors: ${msg}`)
    return { ok: false, reason: msg || "metafieldsSet_failed", metaobjectId, passportUrl }
  }

  return { ok: true, metaobjectId, passportUrl }
}

/**
 * Fire-and-forget wrapper — never rejects; logs failures.
 * Prefer this from request handlers so storefront sync cannot fail passport saves.
 */
export function schedulePassportStorefrontSync(passportId: string | null | undefined): void {
  const id = passportId?.trim()
  if (!id) return
  void syncPassportStorefrontMetafields(id).catch((e) => {
    console.error("[shopify-dpp-sync] unexpected:", e)
  })
}
