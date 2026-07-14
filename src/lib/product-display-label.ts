const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Sentinel UUID — treat like “no product filter” in UI when it appears as state noise. */
export const NIL_UUID = "00000000-0000-0000-0000-000000000000"

/** Collapse empty, whitespace, or nil UUID to `null` for filter / combobox value. */
export function normalizeFilterProductId(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = String(value).trim()
  if (!t || t === NIL_UUID) return null
  return t
}

/** Short, human-digestible token for UI (not a full UUID display). */
export function shortProductIdRef(productId: string): string {
  const t = productId.trim()
  return t.length >= 8 ? t.slice(0, 8) : t || "—"
}

/**
 * Prefer real product names; never surface a bare UUID as the primary label.
 * Use when `name` is missing, empty, or mistakenly stored as a UUID string.
 */
export function productDisplayLabel(
  productId: string,
  name: string | null | undefined,
): string {
  const raw = (name ?? "").trim()
  if (!raw || UUID_RE.test(raw) || raw === productId) {
    return `Unnamed Product (ID: ${shortProductIdRef(productId)})`
  }
  return raw
}
