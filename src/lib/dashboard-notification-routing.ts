/**
 * Deep-link targets for dashboard notifications (certification / compliance wizard).
 * Kept framework-free for unit tests and reuse from API or client.
 */

import { normalizeSkuHint } from "@/lib/products/sku-match"

export type CertificationCatalogRow = { id: string; name?: string | null; sku?: string | null }

export const PRODUCTS_HUB_PATH = "/dashboard/products"

/** Label Studio route (sidebar: QR Identity → Print Labels). */
export const PRINT_LABELS_STUDIO_PATH = "/dashboard/qr-identity/print"

export type PrintStudioDeepLinkParams = {
  batchId?: string | null
  productId?: string | null
  /** Prefills catalog search when ids are unknown (notification copy vs DB batch_number). */
  printSearch?: string | null
}

export function printStudioHref(params: PrintStudioDeepLinkParams): string {
  const q = new URLSearchParams()
  const bid = params.batchId?.trim()
  if (bid) q.set("batchId", bid)
  const pid = params.productId?.trim()
  if (pid) q.set("productId", pid)
  const ps = params.printSearch?.trim()
  if (ps) q.set("printSearch", ps)
  const qs = q.toString()
  return qs ? `${PRINT_LABELS_STUDIO_PATH}?${qs}` : PRINT_LABELS_STUDIO_PATH
}

/**
 * Export-ready notification target: prefer explicit ids, then search hint, then optional demo UUID.
 */
export function resolveExportReadyStudioHref(
  metadata?: { batchId?: string; productId?: string; printSearch?: string },
  opts?: { fallbackProductId?: string },
): string {
  const pid = metadata?.productId?.trim()
  if (pid) return printStudioHref({ productId: pid })
  const bid = metadata?.batchId?.trim()
  if (bid) return printStudioHref({ batchId: bid })
  const ps = metadata?.printSearch?.trim()
  if (ps) return printStudioHref({ printSearch: ps })
  const fb = opts?.fallbackProductId?.trim()
  if (fb) return printStudioHref({ productId: fb })
  return PRINT_LABELS_STUDIO_PATH
}

/**
 * Match notification hints to exactly one catalog row (client-side fallback when SQL resolve misses).
 */
export function pickProductIdForCertificationAlert(
  products: CertificationCatalogRow[],
  hints: { sku?: string; productName?: string },
): string | null {
  if (!products.length) return null

  const skuRaw = hints.sku?.trim()
  if (skuRaw) {
    const skuLower = skuRaw.toLowerCase()
    const hintNorm = normalizeSkuHint(skuRaw)
    const bySku = products.filter((p) => {
      const row = (p.sku ?? "").trim()
      if (!row) return false
      const rowLower = row.toLowerCase()
      if (rowLower === skuLower) return true
      if (hintNorm && normalizeSkuHint(row) === hintNorm) return true
      return false
    })
    if (bySku.length === 1) return bySku[0].id
  }

  const rawName = hints.productName?.trim().toLowerCase()
  if (!rawName || rawName.length < 2) return null

  const byFull = products.filter((p) => {
    const n = (p.name ?? "").trim().toLowerCase()
    if (!n) return false
    return n === rawName || n.includes(rawName) || rawName.includes(n)
  })
  if (byFull.length === 1) return byFull[0].id

  const words = rawName.split(/\s+/).filter((w) => w.length > 2)
  if (words.length === 0) return null

  const byWords = products.filter((p) => {
    const n = (p.name ?? "").trim().toLowerCase()
    if (!n) return false
    return words.every((w) => n.includes(w))
  })
  if (byWords.length === 1) return byWords[0].id

  return null
}

/** Compliance wizard URL. Pass `certSku` / `certName` when `productId` is unknown so the wizard can resolve client-side. */
export function certificationWizardHrefFromHints(params: {
  productId?: string | null
  certSku?: string | null
  certName?: string | null
}): string {
  const q = new URLSearchParams()
  q.set("step", "compliance")
  q.set("highlight", "authenticity")
  q.set("flow", "compliance")
  const id = params.productId?.trim()
  if (id) q.set("productId", id)
  const cs = params.certSku?.trim()
  if (cs) q.set("certSku", cs)
  const cn = params.certName?.trim()
  if (cn) q.set("certName", cn)
  return `/dashboard/products/passport-wizard?${q.toString()}`
}

export function certificationWizardHref(productId: string | null | undefined): string {
  const id = productId?.trim()
  return certificationWizardHrefFromHints(id ? { productId: id } : {})
}

/**
 * Resolve a catalog product id from notification hints (browser or Vitest with mocked `fetch`).
 */
export async function resolveCertificationProductIdFromHints(hints: {
  sku?: string
  productName?: string
}): Promise<string | null> {
  const sku = hints.sku?.trim()
  const productName = hints.productName?.trim()
  if (!sku && !productName) return null

  try {
    const qs = buildProductResolveQuery({ sku, name: productName })
    const res = await fetch(productResolveApiUrl(qs), { credentials: "same-origin" })
    if (res.ok) {
      const data = (await res.json()) as { productId?: string | null }
      if (data.productId) return data.productId
    }
  } catch {
    /* fall through */
  }

  try {
    const mine = await fetch("/api/products/mine", { credentials: "same-origin" })
    if (mine.ok) {
      const data = (await mine.json()) as { products?: CertificationCatalogRow[] }
      const picked = pickProductIdForCertificationAlert(data.products ?? [], { sku, productName })
      if (picked) return picked
    }
  } catch {
    /* fall through */
  }

  return null
}

/** Query string for GET /api/products/resolve (no leading ?). */
export function buildProductResolveQuery(params: { sku?: string; name?: string }): string {
  const p = new URLSearchParams()
  const sku = params.sku?.trim()
  const name = params.name?.trim()
  if (sku) p.set("sku", sku)
  if (name) p.set("name", name)
  return p.toString()
}

export function productResolveApiUrl(searchParams: string): string {
  const q = searchParams.length ? `?${searchParams}` : ""
  return `/api/products/resolve${q}`
}
