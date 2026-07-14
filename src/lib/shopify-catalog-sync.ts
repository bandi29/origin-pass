import { SHOPIFY_API_VERSION } from "@/lib/shopify"
import { withRetry } from "@/lib/resilience"
import type { BulkProductInput } from "@/lib/shopify-sync"
import { SHOPIFY_SYNC_BATCH_SIZE } from "@/lib/shopify-sync"

/** Products per Shopify Admin GraphQL page during manual catalog sync. */
export const SYNC_PAGE_SIZE = SHOPIFY_SYNC_BATCH_SIZE

/** Baseline pause between page fetches to reduce 429 rate-limit hits. */
export const SYNC_PAGE_DELAY_MS = 250

/** Extra delay when Shopify leaky-bucket capacity is low. */
export const SYNC_THROTTLE_HEAVY_DELAY_MS = 2_000
export const SYNC_THROTTLE_MODERATE_DELAY_MS = 1_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function gidToNumericId(gid: string): string {
  return gid.split("/").pop() ?? gid
}

const CATALOG_PAGE_QUERY = /* GraphQL */ `
  query SyncCatalog($cursor: String, $pageSize: Int!) {
    products(first: $pageSize, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          featuredImage { url }
          variants(first: 100) {
            edges { node { id sku title inventoryQuantity } }
          }
        }
      }
    }
  }
`

const CATALOG_COUNT_QUERY = /* GraphQL */ `
  query SyncCatalogCount {
    productsCount {
      count
    }
  }
`

type GraphQLError = { message?: string }

type ShopifyThrottleStatus = {
  maximumAvailable?: number
  currentlyAvailable?: number
  restoreRate?: number
}

type CatalogPageResponse = {
  errors?: GraphQLError[]
  extensions?: { cost?: { throttleStatus?: ShopifyThrottleStatus } }
  data?: {
    products?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
      edges?: Array<{
        node?: {
          id?: string
          title?: string | null
          featuredImage?: { url?: string | null } | null
          variants?: {
            edges?: Array<{
              node?: {
                id?: string
                sku?: string | null
                title?: string | null
                inventoryQuantity?: number | null
              }
            }>
          }
        }
      }>
    }
  }
}

type CatalogCountResponse = {
  errors?: GraphQLError[]
  data?: { productsCount?: { count?: number } }
}

class ShopifyGraphQLError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ShopifyGraphQLError"
    this.status = status
  }
}

type ShopifyGraphqlResult<T> = {
  json: T
  throttleStatus: ShopifyThrottleStatus | null
}

async function shopifyGraphql<T>(
  shop: string,
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<ShopifyGraphqlResult<T>> {
  return withRetry(
    async () => {
      const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      })

      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "0")
        if (retryAfter > 0) await sleep(retryAfter * 1000)
        throw new ShopifyGraphQLError(`Shopify HTTP ${res.status}`, res.status)
      }

      if (!res.ok) {
        throw new ShopifyGraphQLError(`Shopify HTTP ${res.status}`, res.status)
      }

      const json = (await res.json()) as T & {
        extensions?: { cost?: { throttleStatus?: ShopifyThrottleStatus } }
      }
      return {
        json,
        throttleStatus: json.extensions?.cost?.throttleStatus ?? null,
      }
    },
    { attempts: 4, baseDelayMs: 500, maxDelayMs: 8_000 },
  )
}

/** Adaptive delay from Shopify GraphQL leaky-bucket telemetry. */
export function computeAdaptiveSyncDelayMs(throttle: ShopifyThrottleStatus | null | undefined): number {
  if (!throttle?.maximumAvailable || throttle.currentlyAvailable == null) {
    return SYNC_PAGE_DELAY_MS
  }
  const ratio = throttle.currentlyAvailable / throttle.maximumAvailable
  if (ratio < 0.1) return SYNC_THROTTLE_HEAVY_DELAY_MS
  if (ratio < 0.25) return SYNC_THROTTLE_MODERATE_DELAY_MS
  if (ratio < 0.5) return SYNC_PAGE_DELAY_MS
  return SYNC_PAGE_DELAY_MS
}

type CatalogProductEdge = NonNullable<
  NonNullable<CatalogPageResponse["data"]>["products"]
>["edges"]

function sumInventoryQuantity(
  variants: Array<{ inventoryQuantity?: number | null }>,
): number | null {
  let total = 0
  let sawQuantity = false
  for (const variant of variants) {
    if (variant.inventoryQuantity == null || !Number.isFinite(variant.inventoryQuantity)) continue
    sawQuantity = true
    total += Math.max(0, Math.floor(variant.inventoryQuantity))
  }
  return sawQuantity ? total : null
}

/** Map one Shopify GraphQL products page into bulk-upsert inputs. */
export function parseShopifyCatalogPage(edges: CatalogProductEdge | undefined): BulkProductInput[] {
  const pageProducts: BulkProductInput[] = []
  for (const edge of edges ?? []) {
    const node = edge.node
    if (!node?.id) continue
    const variantNodes = (node.variants?.edges ?? [])
      .map((v) => v.node)
      .filter((v): v is { id: string; sku?: string | null; title?: string | null; inventoryQuantity?: number | null } =>
        Boolean(v?.id),
      )

    const variants = variantNodes.map((v) => ({
      id: gidToNumericId(v.id),
      sku: v.sku ?? null,
      inventoryQuantity: v.inventoryQuantity ?? null,
    }))

    const primarySku = variantNodes.map((v) => v.sku?.trim()).find(Boolean) ?? null

    pageProducts.push({
      id: gidToNumericId(node.id),
      title: node.title ?? null,
      imageUrl: node.featuredImage?.url ?? null,
      sku: primarySku,
      inventoryCount: sumInventoryQuantity(variantNodes),
      variants,
    })
  }
  return pageProducts
}

export type ShopifyCatalogPage = {
  products: BulkProductInput[]
  hasNextPage: boolean
  endCursor: string | null
  /** Recommended inter-page delay based on Shopify throttle bucket. */
  suggestedDelayMs: number
}

/** Fetch a single cursor-paginated page from the Shopify Admin catalog. */
export async function fetchShopifyCatalogPage(
  shop: string,
  token: string,
  cursor: string | null = null,
  pageSize = SYNC_PAGE_SIZE,
): Promise<ShopifyCatalogPage> {
  const { json, throttleStatus } = await shopifyGraphql<CatalogPageResponse>(shop, token, CATALOG_PAGE_QUERY, {
    cursor,
    pageSize,
  })

  if (json.errors?.length) {
    throw new ShopifyGraphQLError(
      json.errors.map((e) => e.message).filter(Boolean).join("; ") || "GraphQL error",
      400,
    )
  }

  const products = json.data?.products
  if (!products) {
    throw new ShopifyGraphQLError("Shopify returned an unexpected response.", 400)
  }

  return {
    products: parseShopifyCatalogPage(products.edges),
    hasNextPage: products.pageInfo?.hasNextPage ?? false,
    endCursor: products.pageInfo?.endCursor ?? null,
    suggestedDelayMs: computeAdaptiveSyncDelayMs(throttleStatus),
  }
}

/** Total product count for progress denominator (best-effort). */
export async function fetchShopifyCatalogCount(shop: string, token: string): Promise<number> {
  const { json } = await shopifyGraphql<CatalogCountResponse>(shop, token, CATALOG_COUNT_QUERY)
  if (json.errors?.length) return 0
  return json.data?.productsCount?.count ?? 0
}

export { sleep as syncPageDelay }
