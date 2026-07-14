/**
 * Shopify Admin **Bulk Operations** path for large catalogs (≥ threshold).
 *
 * Rather than iterating thousands of cursor pages (memory + timeout risk), we ask
 * Shopify to export the whole catalog asynchronously (`bulkOperationRunQuery`),
 * poll until it finishes, then STREAM the resulting JSONL file line-by-line into
 * `BulkProductInput[]` — never holding the raw file and the parsed array at once.
 *
 * Bulk JSONL flattens connections: each product is one line; each variant is a
 * separate line carrying `__parentId` pointing at its product. We group as we read.
 */

import { SHOPIFY_API_VERSION } from "@/lib/shopify"
import { withRetry } from "@/lib/resilience"
import { gidToNumericId } from "@/lib/shopify-catalog-sync"
import type { BulkProductInput } from "@/lib/shopify-sync"

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export class ShopifyBulkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ShopifyBulkError"
  }
}

/** The export query — mirrors the cursor path's fields (products + variants). */
const BULK_EXPORT_QUERY = `
{
  products {
    edges {
      node {
        id
        title
        featuredImage { url }
        variants {
          edges { node { id sku inventoryQuantity } }
        }
      }
    }
  }
}
`.trim()

async function bulkGraphql<T>(shop: string, token: string, query: string): Promise<T> {
  return withRetry(
    async () => {
      const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query }),
        cache: "no-store",
      })
      if (res.status === 429 || res.status >= 500) throw new ShopifyBulkError(`Shopify HTTP ${res.status}`)
      if (!res.ok) throw new ShopifyBulkError(`Shopify HTTP ${res.status}`)
      return (await res.json()) as T
    },
    { attempts: 4, baseDelayMs: 500, maxDelayMs: 8_000 },
  )
}

/** Kick off the async catalog export. Returns the bulk operation id. */
export async function startBulkProductExport(shop: string, token: string): Promise<string> {
  const mutation = `
    mutation {
      bulkOperationRunQuery(query: """${BULK_EXPORT_QUERY}""") {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
  `
  try {
    const json = await bulkGraphql<{
      errors?: Array<{ message?: string }>
      data?: {
        bulkOperationRunQuery?: {
          bulkOperation?: { id?: string; status?: string } | null
          userErrors?: Array<{ message?: string }>
        }
      }
    }>(shop, token, mutation)

    if (json.errors?.length) {
      throw new ShopifyBulkError(json.errors.map((e) => e.message).filter(Boolean).join("; ") || "GraphQL error")
    }
    const op = json.data?.bulkOperationRunQuery
    if (op?.userErrors?.length) {
      throw new ShopifyBulkError(op.userErrors.map((e) => e.message).filter(Boolean).join("; "))
    }
    const id = op?.bulkOperation?.id
    if (!id) throw new ShopifyBulkError("Shopify did not start the bulk export.")
    return id
  } catch (err) {
    if (err instanceof ShopifyBulkError) throw err
    throw new ShopifyBulkError(err instanceof Error ? err.message : "Failed to start bulk export.")
  }
}

export type BulkOperationResult = { url: string | null; objectCount: number }

/** Poll `currentBulkOperation` until COMPLETED (returns the JSONL url) or throws. */
export async function pollBulkOperation(
  shop: string,
  token: string,
  opts: { intervalMs?: number; maxAttempts?: number; onPoll?: (objectCount: number) => void } = {},
): Promise<BulkOperationResult> {
  const interval = opts.intervalMs ?? 2_000
  const maxAttempts = opts.maxAttempts ?? 180 // ~6 min ceiling
  const query = `{ currentBulkOperation(type: QUERY) { id status errorCode objectCount url } }`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let status: string | undefined
    let errorCode: string | null | undefined
    let url: string | null | undefined
    let objectCount = 0
    try {
      const json = await bulkGraphql<{
        data?: {
          currentBulkOperation?: {
            status?: string
            errorCode?: string | null
            objectCount?: string | number | null
            url?: string | null
          } | null
        }
      }>(shop, token, query)
      const op = json.data?.currentBulkOperation
      status = op?.status
      errorCode = op?.errorCode
      url = op?.url
      // objectCount is returned as a stringified unsigned int64.
      objectCount = Number(op?.objectCount ?? 0) || 0
    } catch (err) {
      throw new ShopifyBulkError(err instanceof Error ? err.message : "Bulk polling failed.")
    }

    opts.onPoll?.(objectCount)

    if (status === "COMPLETED") return { url: url ?? null, objectCount }
    if (errorCode || status === "FAILED" || status === "CANCELED" || status === "CANCELING") {
      throw new ShopifyBulkError(`Bulk export ${status?.toLowerCase() ?? "failed"}${errorCode ? ` (${errorCode})` : ""}.`)
    }
    await sleep(interval)
  }
  throw new ShopifyBulkError("Bulk export timed out. Please try again in a few minutes.")
}

type MutableProduct = BulkProductInput & { _invTotal: number | null }

function pickImageUrl(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "url" in raw) {
    const url = (raw as { url?: unknown }).url
    return typeof url === "string" ? url : null
  }
  return null
}

/** Stream the JSONL export and group variant lines under their product parents. */
export async function downloadAndParseBulkProducts(url: string): Promise<BulkProductInput[]> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new ShopifyBulkError("Could not download the catalog export file.")

  const byGid = new Map<string, MutableProduct>()

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      return // tolerate a malformed line rather than aborting the whole import
    }

    const gid = typeof obj.id === "string" ? obj.id : ""
    const parentId = typeof obj.__parentId === "string" ? obj.__parentId : null

    if (parentId) {
      // Variant line.
      const parent = byGid.get(parentId)
      if (!parent || !gid) return
      const inv = typeof obj.inventoryQuantity === "number" && Number.isFinite(obj.inventoryQuantity) ? obj.inventoryQuantity : null
      parent.variants.push({
        id: gidToNumericId(gid),
        sku: typeof obj.sku === "string" ? obj.sku : null,
        inventoryQuantity: inv,
      })
      if (inv != null) parent._invTotal = (parent._invTotal ?? 0) + Math.max(0, Math.floor(inv))
      return
    }

    // Product line.
    if (!gid) return
    byGid.set(gid, {
      id: gidToNumericId(gid),
      title: typeof obj.title === "string" ? obj.title : null,
      imageUrl: pickImageUrl(obj.featuredImage),
      sku: null,
      inventoryCount: null,
      variants: [],
      _invTotal: null,
    })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf("\n")) >= 0) {
      handleLine(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 1)
    }
  }
  if (buffer) handleLine(buffer)

  const products: BulkProductInput[] = []
  for (const p of byGid.values()) {
    products.push({
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      sku: p.variants.map((v) => v.sku?.trim()).find(Boolean) ?? null,
      inventoryCount: p._invTotal,
      variants: p.variants,
    })
  }
  return products
}
