/**
 * Embedded connection gate helpers.
 *
 * First paint behind `shopify app dev` often races Turbopack compile / tunnel
 * warm-up. Treat 5xx and network blips as "unknown" and retry instead of
 * immediately starting OAuth (which looks like a scary first-load error, then
 * works after refresh).
 */

export type ConnectionCheckResult = {
  /** Definitive answer when non-null. */
  connected: boolean | null
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Query offline-token presence with retries.
 * Returns `connected: true|false` when the API (or fallback) answers clearly,
 * or `connected: null` when every attempt was transient.
 */
export async function checkStoreConnection(opts: {
  shop: string
  sessionToken?: string
  /** Optional Server Action fallback after GET retries fail. */
  fallback?: (shop: string, sessionToken?: string) => Promise<boolean>
  attempts?: number
}): Promise<ConnectionCheckResult> {
  const attempts = opts.attempts ?? 3
  const headers: HeadersInit = {}
  if (opts.sessionToken) headers.Authorization = `Bearer ${opts.sessionToken}`

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(
        `/api/shopify/connection-status?shop=${encodeURIComponent(opts.shop)}`,
        { headers, cache: "no-store" },
      )
      if (res.ok) {
        const body = (await res.json()) as { connected?: boolean }
        return { connected: Boolean(body.connected) }
      }
      // 4xx from this route means invalid shop -- definitive not connected.
      if (res.status >= 400 && res.status < 500) {
        return { connected: false }
      }
    } catch {
      // network / tunnel blip
    }
    if (attempt < attempts - 1) await delay(350 * (attempt + 1))
  }

  if (opts.fallback) {
    try {
      return { connected: await opts.fallback(opts.shop, opts.sessionToken) }
    } catch {
      return { connected: null }
    }
  }

  return { connected: null }
}
