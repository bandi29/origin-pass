/** Strip ILIKE metacharacters from user-provided fragments (safe contains patterns). */
export function ilikeLiteralFragment(s: string): string {
  return s.replace(/\\/g, "").replace(/%/g, "").replace(/_/g, "").trim()
}

export type ResolveProductInput = {
  sku?: string
  name?: string
}

export type ResolveProductReason = "ok" | "not_found" | "ambiguous" | "no_input"

/**
 * Sequential lookup: SKU (ILIKE) → exact name (ILIKE) → name contains `%fragment%`.
 * Matches {@link src/app/api/products/resolve/route.ts} behavior for tests and reuse.
 */
export async function resolveScopedProductIds(
  input: ResolveProductInput,
  /** Return up to 2 product ids for the given filter (same as DB limit 2). */
  queryIds: (filter: { type: "sku"; value: string } | { type: "name_exact"; value: string } | { type: "name_loose"; value: string }) => Promise<string[]>,
): Promise<{ productId: string | null; reason: ResolveProductReason }> {
  const sku = input.sku?.trim() ?? ""
  const name = input.name?.trim() ?? ""
  if (!sku && !name) {
    return { productId: null, reason: "no_input" }
  }

  let list: string[] = []

  if (sku) {
    list = await queryIds({ type: "sku", value: sku })
    if (list.length === 1) return { productId: list[0], reason: "ok" }
  }

  if (name) {
    list = await queryIds({ type: "name_exact", value: name })
    if (list.length === 1) return { productId: list[0], reason: "ok" }

    const frag = ilikeLiteralFragment(name)
    if (frag.length >= 3) {
      list = await queryIds({ type: "name_loose", value: `%${frag}%` })
      if (list.length === 1) return { productId: list[0], reason: "ok" }
    }
  }

  return { productId: null, reason: list.length === 0 ? "not_found" : "ambiguous" }
}
