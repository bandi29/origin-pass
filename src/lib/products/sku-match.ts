/**
 * Normalize SKU hints from notifications / UI (e.g. "SKU-302") for comparison and lookup.
 */

/** Lowercase, trim; strip a leading "SKU" / "#" style label. */
export function normalizeSkuHint(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^sku[\s:#-]+/i, "")
    .replace(/^#+/, "")
    .trim()
}

/** Unique candidates for exact ILIKE on `products.sku` (no SQL wildcards in returned strings). */
export function skuExactIlikeCandidates(hint: string): string[] {
  const raw = hint.trim()
  if (!raw) return []
  const norm = normalizeSkuHint(raw)
  const out: string[] = []
  const push = (v: string) => {
    const t = v.trim()
    if (!t) return
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  push(raw)
  const normDisplay = norm && norm !== raw.toLowerCase() ? norm : ""
  if (normDisplay) push(normDisplay)
  return out
}
